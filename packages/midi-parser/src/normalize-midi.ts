import type { Midi } from '@tonejs/midi';
import { SONG_SCHEMA_VERSION } from '@thinkbreak/audio-runtime';
import type {
	ChannelRole,
	CompiledNote,
	CompiledSong,
	CompiledTrack,
	ModulationEvent,
	PitchBendEvent,
	SongMarker,
	TempoChange,
	TimeSignatureChange,
	TrackVolumeEvent
} from '@thinkbreak/audio-runtime';
import { MAX_MIDI_IMPORT_WARNINGS } from './constants';
import type { ScannedEvent } from './scan-midi-events';

export interface MidiImportWarning {
	sourceFilename: string;
	trackName: string;
	trackIndex: number;
	eventType: string;
	tick: number;
	message: string;
	suggestedAction: string | null;
}

export interface TrackRoleSuggestion {
	trackId: string;
	trackIndex: number;
	sourceTrackName: string;
	role: ChannelRole;
	reason: string;
	confidence: 'high' | 'low';
}

export interface NormalizedTrack {
	id: string;
	trackIndex: number;
	sourceTrackName: string;
	midiChannel: number;
	hasNotes: boolean;
	hasMarker: boolean;
}

interface WarningOccurrence {
	sourceFilename: string;
	trackName: string;
	trackIndex: number;
	eventType: string;
	tick: number;
	count?: number;
	message: (count: number) => string;
	suggestedAction: string | null;
}

interface AggregatedWarning extends WarningOccurrence {
	count: number;
}

export class MidiWarningCollector {
	private readonly warningsByTrackAndType = new Map<string, AggregatedWarning>();

	add(warning: WarningOccurrence): void {
		const key = `${warning.trackIndex}\u0000${warning.eventType}`;
		const existing = this.warningsByTrackAndType.get(key);
		const count = warning.count ?? 1;
		if (existing === undefined) {
			this.warningsByTrackAndType.set(key, { ...warning, count });
			return;
		}

		existing.count += count;
		if (warning.tick < existing.tick) {
			existing.tick = warning.tick;
			existing.trackName = warning.trackName;
		}
	}

	toWarnings(): readonly MidiImportWarning[] {
		const warnings = [...this.warningsByTrackAndType.values()];
		const visibleWarnings = warnings.slice(0, MAX_MIDI_IMPORT_WARNINGS).map((warning) => ({
			sourceFilename: warning.sourceFilename,
			trackName: warning.trackName,
			trackIndex: warning.trackIndex,
			eventType: warning.eventType,
			tick: warning.tick,
			message: warning.message(warning.count),
			suggestedAction: warning.suggestedAction
		}));

		if (warnings.length <= MAX_MIDI_IMPORT_WARNINGS) return visibleWarnings;

		return [
			...visibleWarnings,
			{
				sourceFilename: warnings[0]?.sourceFilename ?? '',
				trackName: 'Header',
				trackIndex: -1,
				eventType: 'warningsTruncated',
				tick: 0,
				message: `Warnings were truncated after ${MAX_MIDI_IMPORT_WARNINGS} entries.`,
				suggestedAction: null
			}
		];
	}
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function normalizedTick(value: number): number {
	return Math.max(0, Math.round(value));
}

function normalizedPositiveInteger(value: number): number {
	return Math.max(1, Math.round(value));
}

function sourceTrackName(name: string, trackIndex: number): string {
	const trimmedName = name.trim();
	return trimmedName === '' ? `Track ${trackIndex + 1}` : trimmedName;
}

function sourceMidiChannel(channel: number): number {
	return Number.isInteger(channel) && channel >= 0 && channel <= 15 ? channel : -1;
}

function addHeaderWarning(
	warnings: MidiWarningCollector,
	sourceFilename: string,
	eventType: string,
	tick: number,
	message: (count: number) => string
): void {
	warnings.add({
		sourceFilename,
		trackName: 'Header',
		trackIndex: -1,
		eventType,
		tick,
		message,
		suggestedAction: null
	});
}

function normalizeTempoChanges(
	midi: Midi,
	sourceFilename: string,
	warnings: MidiWarningCollector
): TempoChange[] {
	const changesByTick = new Map<number, TempoChange>();
	for (const tempo of midi.header.tempos) {
		const tick = normalizedTick(tempo.ticks);
		const unclampedBpm = tempo.bpm;
		const bpm = clamp(unclampedBpm, 1, 999);
		if (bpm !== unclampedBpm) {
			addHeaderWarning(
				warnings,
				sourceFilename,
				'tempoClamped',
				tick,
				(count) =>
					`Clamped ${count} tempo event${count === 1 ? '' : 's'} to the supported range of 1 to 999 BPM.`
			);
		}
		changesByTick.set(tick, { tick, bpm });
	}

	if (!changesByTick.has(0)) {
		changesByTick.set(0, { tick: 0, bpm: 120 });
		addHeaderWarning(
			warnings,
			sourceFilename,
			'tempo',
			0,
			() =>
				'Added the default tempo of 120 BPM at tick 0 because the file has no tempo event there.'
		);
	}

	return [...changesByTick.values()].sort((left, right) => left.tick - right.tick);
}

function normalizeTimeSignatures(
	midi: Midi,
	sourceFilename: string,
	warnings: MidiWarningCollector
): TimeSignatureChange[] {
	const changesByTick = new Map<number, TimeSignatureChange>();
	for (const timeSignature of midi.header.timeSignatures) {
		const tick = normalizedTick(timeSignature.ticks);
		const numerator = normalizedPositiveInteger(timeSignature.timeSignature[0] ?? 4);
		const denominator = normalizedPositiveInteger(timeSignature.timeSignature[1] ?? 4);
		changesByTick.set(tick, { tick, numerator, denominator });
	}

	if (!changesByTick.has(0)) {
		changesByTick.set(0, { tick: 0, numerator: 4, denominator: 4 });
		addHeaderWarning(
			warnings,
			sourceFilename,
			'timeSignature',
			0,
			() =>
				'Added the default 4/4 time signature at tick 0 because the file has no time-signature event there.'
		);
	}

	return [...changesByTick.values()].sort((left, right) => left.tick - right.tick);
}

function normalizeMarkers(
	midi: Midi,
	sourceFilename: string,
	warnings: MidiWarningCollector
): SongMarker[] {
	const markers: SongMarker[] = [];
	for (const metaEvent of midi.header.meta) {
		if (metaEvent.type !== 'marker' && metaEvent.type !== 'cuePoint') continue;

		const name = metaEvent.text.trim();
		const tick = normalizedTick(metaEvent.ticks);
		if (name === '') {
			addHeaderWarning(
				warnings,
				sourceFilename,
				'marker',
				tick,
				(count) => `Dropped ${count} marker event${count === 1 ? '' : 's'} with an empty name.`
			);
			continue;
		}

		markers.push({ tick, name });
	}

	return markers.sort((left, right) => left.tick - right.tick);
}

function normalizeNotes(
	midi: Midi,
	trackIndex: number,
	trackName: string,
	sourceFilename: string,
	warnings: MidiWarningCollector
): CompiledNote[] {
	const track = midi.tracks[trackIndex];
	if (track === undefined) return [];

	const notes: CompiledNote[] = [];
	for (const note of track.notes) {
		const tick = normalizedTick(note.ticks);
		const midiNote = Math.round(note.midi);
		if (midiNote < 0 || midiNote > 127) {
			warnings.add({
				sourceFilename,
				trackName,
				trackIndex,
				eventType: 'invalidNote',
				tick,
				message: (count) =>
					`Dropped ${count} note event${count === 1 ? '' : 's'} with a MIDI note outside 0 to 127.`,
				suggestedAction: null
			});
			continue;
		}

		const velocity = clamp(note.velocity, 0, 1);
		if (velocity === 0) {
			warnings.add({
				sourceFilename,
				trackName,
				trackIndex,
				eventType: 'zeroVelocityNote',
				tick,
				message: (count) => `Dropped ${count} note event${count === 1 ? '' : 's'} with velocity 0.`,
				suggestedAction: null
			});
			continue;
		}

		notes.push({
			tick,
			durationTicks: Math.max(1, Math.round(note.durationTicks)),
			midiNote,
			velocity
		});
	}

	return notes.sort((left, right) => left.tick - right.tick || left.midiNote - right.midiNote);
}

function normalizePitchBends(midi: Midi, trackIndex: number): PitchBendEvent[] {
	const track = midi.tracks[trackIndex];
	if (track === undefined) return [];

	return track.pitchBends
		.map((pitchBend) => ({
			tick: normalizedTick(pitchBend.ticks),
			value: clamp(pitchBend.value, -1, 1)
		}))
		.sort((left, right) => left.tick - right.tick);
}

function normalizeControlChanges<T extends ModulationEvent | TrackVolumeEvent>(
	midi: Midi,
	trackIndex: number,
	controllerNumber: 1 | 7
): T[] {
	const track = midi.tracks[trackIndex];
	if (track === undefined) return [];

	const controlChanges = track.controlChanges[controllerNumber] ?? [];
	return controlChanges
		.map(
			(controlChange) =>
				({
					tick: normalizedTick(controlChange.ticks),
					value: clamp(controlChange.value, 0, 1)
				}) as T
		)
		.sort((left, right) => left.tick - right.tick);
}

function hasMarkerEvent(scannedEvents: readonly ScannedEvent[] | undefined): boolean {
	return (
		scannedEvents?.some(
			(event) => event.eventType === 'meta:marker' || event.eventType === 'meta:cuePoint'
		) ?? false
	);
}

function hasControllerEvent(scannedEvents: readonly ScannedEvent[] | undefined): boolean {
	return scannedEvents?.some((event) => event.eventType.startsWith('controlChange:')) ?? false;
}

export function normalizeMidi(input: {
	midi: Midi;
	sourceFilename: string;
	songId: string;
	scannedEventsByTrack: readonly (readonly ScannedEvent[] | undefined)[];
	warnings: MidiWarningCollector;
}): { song: CompiledSong; tracks: readonly NormalizedTrack[] } {
	const { midi, sourceFilename, songId, scannedEventsByTrack, warnings } = input;
	const tempoChanges = normalizeTempoChanges(midi, sourceFilename, warnings);
	const timeSignatures = normalizeTimeSignatures(midi, sourceFilename, warnings);
	const markers = normalizeMarkers(midi, sourceFilename, warnings);
	const tracks: CompiledTrack[] = [];
	const normalizedTracks: NormalizedTrack[] = [];
	let durationTicks = Math.max(
		...tempoChanges.map((change) => change.tick),
		...timeSignatures.map((change) => change.tick),
		...markers.map((marker) => marker.tick),
		...midi.header.keySignatures.map((keySignature) => normalizedTick(keySignature.ticks)),
		...midi.header.meta.map((metaEvent) => normalizedTick(metaEvent.ticks)),
		0
	);

	for (let trackIndex = 0; trackIndex < midi.tracks.length; trackIndex += 1) {
		const track = midi.tracks[trackIndex];
		if (track === undefined) continue;

		const trackName = sourceTrackName(track.name, trackIndex);
		const scannedEvents = scannedEventsByTrack[trackIndex];
		const notes = normalizeNotes(midi, trackIndex, trackName, sourceFilename, warnings);
		const pitchBends = normalizePitchBends(midi, trackIndex);
		const modulationEvents = normalizeControlChanges<ModulationEvent>(midi, trackIndex, 1);
		const volumeEvents = normalizeControlChanges<TrackVolumeEvent>(midi, trackIndex, 7);
		const hasMarker = hasMarkerEvent(scannedEvents);
		const hasController = hasControllerEvent(scannedEvents);
		const hasEvents =
			notes.length > 0 ||
			pitchBends.length > 0 ||
			modulationEvents.length > 0 ||
			volumeEvents.length > 0 ||
			hasMarker ||
			hasController;
		durationTicks = Math.max(durationTicks, normalizedTick(track.endOfTrackTicks ?? 0));

		if (!hasEvents) {
			warnings.add({
				sourceFilename,
				trackName,
				trackIndex,
				eventType: 'emptyTrack',
				tick: 0,
				message: () => 'Skipped an empty source track.',
				suggestedAction: null
			});
			continue;
		}

		const midiChannel = sourceMidiChannel(track.channel);
		const id = crypto.randomUUID();
		tracks.push({
			id,
			sourceTrackName: trackName,
			midiChannel,
			notes,
			pitchBends,
			modulationEvents,
			volumeEvents
		});
		normalizedTracks.push({
			id,
			trackIndex,
			sourceTrackName: trackName,
			midiChannel,
			hasNotes: notes.length > 0,
			hasMarker
		});

		for (const note of notes)
			durationTicks = Math.max(durationTicks, note.tick + note.durationTicks);
		for (const pitchBend of pitchBends) durationTicks = Math.max(durationTicks, pitchBend.tick);
		for (const controlChange of modulationEvents)
			durationTicks = Math.max(durationTicks, controlChange.tick);
		for (const controlChange of volumeEvents)
			durationTicks = Math.max(durationTicks, controlChange.tick);
	}

	return {
		song: {
			schemaVersion: SONG_SCHEMA_VERSION,
			id: songId,
			sourceFilename,
			ticksPerQuarterNote: midi.header.ppq,
			durationTicks,
			tempoChanges,
			timeSignatures,
			markers,
			tracks
		},
		tracks: normalizedTracks
	};
}
