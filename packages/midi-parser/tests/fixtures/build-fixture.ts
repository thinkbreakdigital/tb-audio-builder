import { Midi } from '@tonejs/midi';

export interface MidiFixtureNoteSpec {
	tick: number;
	durationTicks: number;
	midiNote: number;
	velocity: number;
}

export interface MidiFixtureControlChangeSpec {
	controller: number;
	tick: number;
	value: number;
}

export interface MidiFixturePitchBendSpec {
	tick: number;
	value: number;
}

export interface MidiFixtureProgramChangeSpec {
	tick: number;
	programNumber: number;
}

export interface MidiFixtureAftertouchSpec {
	tick: number;
	pressure: number;
}

export interface MidiFixtureMarkerSpec {
	tick: number;
	name: string;
}

export interface MidiFixtureTrackSpec {
	name?: string;
	channel?: number;
	notes?: MidiFixtureNoteSpec[];
	controlChanges?: MidiFixtureControlChangeSpec[];
	pitchBends?: MidiFixturePitchBendSpec[];
	// The three fields below have no equivalent on @tonejs/midi's Track class (there is no
	// addProgramChange/addAftertouch/addMarker), so buildMidiFixture splices them into the encoded
	// bytes after the fact. See the "byte-level splicing" section below.
	programChanges?: MidiFixtureProgramChangeSpec[];
	aftertouch?: MidiFixtureAftertouchSpec[];
	// Marker meta events scoped to this specific track's own MTrk chunk (as opposed to the
	// top-level `markers` field below, which is song-scoped). The MIDI parser's per-track "note-free
	// track with a marker suggests metadata" rule scans each track's own raw bytes for these, so a
	// marker has to live inside the track it is meant to be associated with.
	markers?: MidiFixtureMarkerSpec[];
}

export interface MidiFixtureSpec {
	ppq?: number;
	tempos?: { tick: number; bpm: number }[];
	timeSignatures?: { tick: number; numerator: number; denominator: number }[];
	// Song-level marker meta events. @tonejs/midi only reads marker/cuePoint meta events out of
	// the very first MTrk chunk in the file (its synthetic "header" track), so these are spliced
	// into that chunk. See the "byte-level splicing" section below.
	markers?: MidiFixtureMarkerSpec[];
	tracks: MidiFixtureTrackSpec[];
}

const PITCH_BEND_RAW_RANGE = 8192;

/**
 * Builds a Standard MIDI File in memory and returns its bytes.
 *
 * Most of the work goes through @tonejs/midi's own write path (`new Midi()`, `addTrack()`,
 * `addNote()`, `addCC()`, `addPitchBend()`, `header.tempos`, `header.timeSignatures`,
 * `toArray()`), because that is the same code every real MIDI file the Builder ever sees was
 * either produced by or is compatible with, and it keeps this file honest about what a normal
 * writer emits.
 *
 * `programChanges`, `aftertouch`, and `markers` are the exception: @tonejs/midi's `Track` class
 * has no method to add a mid-track program change (only the automatic one at tick 0 derived from
 * `track.instrument.number`) or a channel/poly aftertouch event at all, and its `Header` class has
 * no `addMarker`. Those three are appended by editing the encoded MTrk chunks directly — see
 * `spliceExtraEvents` below.
 */
export function buildMidiFixture(spec: MidiFixtureSpec): ArrayBuffer {
	const midi = new Midi();

	if (spec.ppq !== undefined) {
		// Header#ppq has no public setter; fromJSON is the only way to override it. It resets
		// tempos/timeSignatures/meta/keySignatures to empty arrays, which is fine because we set
		// tempos and timeSignatures immediately afterward.
		midi.header.fromJSON({
			name: '',
			ppq: spec.ppq,
			meta: [],
			tempos: [],
			timeSignatures: [],
			keySignatures: []
		});
	}

	for (const tempo of spec.tempos ?? []) {
		midi.header.tempos.push({ ticks: tempo.tick, bpm: tempo.bpm });
	}
	for (const timeSignature of spec.timeSignatures ?? []) {
		midi.header.timeSignatures.push({
			ticks: timeSignature.tick,
			timeSignature: [timeSignature.numerator, timeSignature.denominator]
		});
	}
	midi.header.update();

	for (const trackSpec of spec.tracks) {
		const track = midi.addTrack();
		if (trackSpec.name !== undefined) track.name = trackSpec.name;
		if (trackSpec.channel !== undefined) track.channel = trackSpec.channel;

		for (const note of trackSpec.notes ?? []) {
			track.addNote({
				midi: note.midiNote,
				ticks: note.tick,
				durationTicks: note.durationTicks,
				velocity: note.velocity
			});
		}
		for (const controlChange of trackSpec.controlChanges ?? []) {
			track.addCC({
				number: controlChange.controller,
				ticks: controlChange.tick,
				value: controlChange.value
			});
		}
		for (const pitchBend of trackSpec.pitchBends ?? []) {
			track.addPitchBend({
				ticks: pitchBend.tick,
				// addPitchBend stores its value verbatim and the encoder adds it to 0x2000 as-is
				// (it does not re-normalize), so the raw 14-bit-signed offset has to be computed
				// here rather than passing the -1..1 value straight through.
				value: Math.round(pitchBend.value * PITCH_BEND_RAW_RANGE)
			});
		}
	}

	const bytes = midi.toArray();
	const patched = spliceExtraEvents(bytes, spec);
	return toArrayBuffer(patched);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

// ---------------------------------------------------------------------------------------------
// Byte-level splicing.
//
// A Standard MIDI File is a 'MThd' header chunk followed by one or more 'MTrk' chunks. Each MTrk
// chunk is a flat sequence of <delta-time VLQ><event bytes>, ending with an explicit end-of-track
// meta event (FF 2F 00). @tonejs/midi's own encoder never uses running status (it always emits a
// full status byte before every event's data bytes), so the reader below does not need to
// preserve running status either; every event it writes back out gets its own explicit status
// byte, which is the simplest correct way to splice new events into an existing chunk.
// ---------------------------------------------------------------------------------------------

interface MidiChunk {
	id: string;
	body: Uint8Array;
}

type TrackEvent =
	| { tick: number; kind: 'channel'; status: number; data: number[] }
	| { tick: number; kind: 'meta'; metaType: number; data: number[] }
	| { tick: number; kind: 'sysex'; status: number; data: number[] }
	| { tick: number; kind: 'endOfTrack' };

function spliceExtraEvents(bytes: Uint8Array, spec: MidiFixtureSpec): Uint8Array {
	const hasMarkers = (spec.markers ?? []).length > 0;
	const hasTrackExtras = spec.tracks.some(
		(track) =>
			(track.programChanges ?? []).length > 0 ||
			(track.aftertouch ?? []).length > 0 ||
			(track.markers ?? []).length > 0
	);
	if (!hasMarkers && !hasTrackExtras) return bytes;

	const chunks = splitIntoChunks(bytes);

	// chunks[0] is 'MThd'. chunks[1] is the synthetic header/meta track @tonejs/midi's encoder
	// always writes first (name, tempos, time signatures, meta events). chunks[2 + i] is
	// spec.tracks[i].
	const HEADER_TRACK_CHUNK_INDEX = 1;

	if (hasMarkers) {
		const markerEvents: TrackEvent[] = (spec.markers ?? []).map((marker) => ({
			tick: marker.tick,
			kind: 'meta',
			metaType: 0x06,
			data: Array.from(new TextEncoder().encode(marker.name))
		}));
		chunks[HEADER_TRACK_CHUNK_INDEX] = requireChunk(chunks, HEADER_TRACK_CHUNK_INDEX, (spliceOne) =>
			injectEvents(spliceOne, markerEvents)
		);
	}

	spec.tracks.forEach((trackSpec, trackIndex) => {
		const channel = trackSpec.channel ?? 0;
		const extra: TrackEvent[] = [
			...(trackSpec.programChanges ?? []).map((programChange): TrackEvent => ({
				tick: programChange.tick,
				kind: 'channel',
				status: 0xc0 | channel,
				data: [programChange.programNumber & 0x7f]
			})),
			...(trackSpec.aftertouch ?? []).map((aftertouch): TrackEvent => ({
				tick: aftertouch.tick,
				kind: 'channel',
				status: 0xd0 | channel,
				data: [aftertouch.pressure & 0x7f]
			})),
			...(trackSpec.markers ?? []).map((marker): TrackEvent => ({
				tick: marker.tick,
				kind: 'meta',
				metaType: 0x06,
				data: Array.from(new TextEncoder().encode(marker.name))
			}))
		];
		if (extra.length === 0) return;

		const chunkIndex = HEADER_TRACK_CHUNK_INDEX + 1 + trackIndex;
		chunks[chunkIndex] = requireChunk(chunks, chunkIndex, (spliceOne) =>
			injectEvents(spliceOne, extra)
		);
	});

	return buildFile(chunks);
}

function requireChunk(
	chunks: MidiChunk[],
	index: number,
	patch: (body: Uint8Array) => Uint8Array
): MidiChunk {
	const chunk = chunks[index];
	if (chunk === undefined) {
		throw new Error(
			`build-fixture: expected an MTrk chunk at index ${index} while splicing extra events, ` +
				`but the encoded file only has ${chunks.length} chunks.`
		);
	}
	return { id: chunk.id, body: patch(chunk.body) };
}

function injectEvents(trackBody: Uint8Array, extra: TrackEvent[]): Uint8Array {
	const existing = parseTrackEvents(trackBody).filter((event) => event.kind !== 'endOfTrack');
	return serializeTrackEvents([...existing, ...extra]);
}

function parseTrackEvents(trackBody: Uint8Array): TrackEvent[] {
	const events: TrackEvent[] = [];
	let offset = 0;
	let tick = 0;
	let runningStatus: number | undefined;

	while (offset < trackBody.length) {
		const delta = readVarInt(trackBody, offset);
		offset = delta.nextOffset;
		tick += delta.value;

		const firstByte = trackBody[offset];
		if (firstByte === undefined) {
			throw new Error('build-fixture: unexpected end of track data while reading a status byte.');
		}

		let status: number;
		if ((firstByte & 0x80) !== 0) {
			status = firstByte;
			offset += 1;
			runningStatus = status;
		} else {
			if (runningStatus === undefined) {
				throw new Error(
					'build-fixture: encountered a running-status data byte with no prior status byte.'
				);
			}
			status = runningStatus;
			// Do not advance offset: this byte is the first data byte, not a status byte.
		}

		if (status === 0xff) {
			const metaType = trackBody[offset];
			if (metaType === undefined) {
				throw new Error('build-fixture: unexpected end of track data while reading a meta type.');
			}
			offset += 1;
			const length = readVarInt(trackBody, offset);
			offset = length.nextOffset;
			const data = Array.from(trackBody.slice(offset, offset + length.value));
			offset += length.value;

			if (metaType === 0x2f) {
				events.push({ tick, kind: 'endOfTrack' });
				break;
			}
			events.push({ tick, kind: 'meta', metaType, data });
		} else if (status === 0xf0 || status === 0xf7) {
			const length = readVarInt(trackBody, offset);
			offset = length.nextOffset;
			const data = Array.from(trackBody.slice(offset, offset + length.value));
			offset += length.value;
			events.push({ tick, kind: 'sysex', status, data });
		} else {
			const highNibble = status & 0xf0;
			const dataLength = highNibble === 0xc0 || highNibble === 0xd0 ? 1 : 2;
			const data = Array.from(trackBody.slice(offset, offset + dataLength));
			offset += dataLength;
			events.push({ tick, kind: 'channel', status, data });
		}
	}

	return events;
}

function serializeTrackEvents(events: TrackEvent[]): Uint8Array {
	// Array#sort is stable, so events that started at the same tick keep their relative order.
	const sorted = [...events].sort((a, b) => a.tick - b.tick);

	const bytes: number[] = [];
	let lastTick = 0;
	for (const event of sorted) {
		writeVarInt(bytes, event.tick - lastTick);
		lastTick = event.tick;

		if (event.kind === 'channel') {
			bytes.push(event.status, ...event.data);
		} else if (event.kind === 'meta') {
			bytes.push(0xff, event.metaType);
			writeVarInt(bytes, event.data.length);
			bytes.push(...event.data);
		} else if (event.kind === 'sysex') {
			bytes.push(event.status);
			writeVarInt(bytes, event.data.length);
			bytes.push(...event.data);
		}
		// 'endOfTrack' entries from the original chunk are dropped by the caller before this
		// function runs; a fresh one is always appended below instead.
	}

	writeVarInt(bytes, 0);
	bytes.push(0xff, 0x2f, 0x00);

	return Uint8Array.from(bytes);
}

function readVarInt(bytes: Uint8Array, offset: number): { value: number; nextOffset: number } {
	let value = 0;
	let cursor = offset;
	while (true) {
		const byte = bytes[cursor];
		if (byte === undefined) {
			throw new Error(
				'build-fixture: unexpected end of data while reading a variable-length quantity.'
			);
		}
		value = (value << 7) | (byte & 0x7f);
		cursor += 1;
		if ((byte & 0x80) === 0) break;
	}
	return { value, nextOffset: cursor };
}

function writeVarInt(out: number[], value: number): void {
	if (value < 0) {
		throw new Error(`build-fixture: cannot write a negative variable-length quantity: ${value}.`);
	}
	const septets: number[] = [value & 0x7f];
	let remainder = Math.floor(value / 128);
	while (remainder > 0) {
		septets.push((remainder & 0x7f) | 0x80);
		remainder = Math.floor(remainder / 128);
	}
	out.push(...septets.reverse());
}

function splitIntoChunks(bytes: Uint8Array): MidiChunk[] {
	const chunks: MidiChunk[] = [];
	let offset = 0;
	while (offset < bytes.length) {
		const idBytes = bytes.slice(offset, offset + 4);
		const id = new TextDecoder('ascii').decode(idBytes);
		offset += 4;

		const lengthBytes = bytes.slice(offset, offset + 4);
		const length =
			((lengthBytes[0] ?? 0) << 24) |
			((lengthBytes[1] ?? 0) << 16) |
			((lengthBytes[2] ?? 0) << 8) |
			(lengthBytes[3] ?? 0);
		const unsignedLength = length >>> 0;
		offset += 4;

		const body = bytes.slice(offset, offset + unsignedLength);
		offset += unsignedLength;

		chunks.push({ id, body });
	}
	return chunks;
}

function buildFile(chunks: MidiChunk[]): Uint8Array {
	const parts: Uint8Array[] = [];
	for (const chunk of chunks) {
		const header = new Uint8Array(8);
		header.set(new TextEncoder().encode(chunk.id), 0);
		const length = chunk.body.length;
		header[4] = (length >>> 24) & 0xff;
		header[5] = (length >>> 16) & 0xff;
		header[6] = (length >>> 8) & 0xff;
		header[7] = length & 0xff;
		parts.push(header, chunk.body);
	}

	const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
	const out = new Uint8Array(totalLength);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}
