import MidiPackage from '@tonejs/midi';
import type { Midi as MidiFile } from '@tonejs/midi';
import type { CompiledSong } from '@thinkbreak/audio-runtime';
import { CompiledSongSchema, parseOrThrow } from '@thinkbreak/project-schema';
import { MAX_MIDI_FILE_BYTES } from './constants.js';
import { MidiImportError } from './errors.js';
import {
	ignoredEventMessage,
	classifyScannedEvent,
	isSilentlyIgnoredEventType
} from './supported-events.js';
import {
	MidiWarningCollector,
	normalizeMidi,
	type MidiImportWarning,
	type TrackRoleSuggestion
} from './normalize-midi.js';
import { scanMidiEvents, type ScannedEvent, type ScannedMidiFile } from './scan-midi-events.js';
import { suggestRoleForTrackName } from './suggest-role.js';

// @tonejs/midi@2 publishes CommonJS through its `main` field. Bundlers synthesize named exports,
// but native Node ESM exposes that CommonJS namespace only as the default export.
const { Midi } = MidiPackage;

export interface MidiCompileResult {
	song: CompiledSong;
	warnings: readonly MidiImportWarning[];
	suggestions: readonly TrackRoleSuggestion[];
}

interface ParsedMidiInput {
	midi: MidiFile;
	scannedMidiFile: ScannedMidiFile | undefined;
}

interface ScannedEventAttribution {
	eventsByParsedTrack: readonly (readonly ScannedEvent[])[];
	fileLevelEvents: readonly ScannedEvent[];
	complete: boolean;
}

function hasMidiHeader(fileBytes: ArrayBuffer): boolean {
	const bytes = new Uint8Array(fileBytes);
	return bytes[0] === 0x4d && bytes[1] === 0x54 && bytes[2] === 0x68 && bytes[3] === 0x64;
}

function parseMidiFile(fileBytes: ArrayBuffer, filename: string): ParsedMidiInput {
	if (fileBytes.byteLength === 0) {
		throw new MidiImportError(filename, 'is empty.');
	}

	if (fileBytes.byteLength > MAX_MIDI_FILE_BYTES) {
		throw new MidiImportError(
			filename,
			`is ${fileBytes.byteLength} bytes, which exceeds the ${MAX_MIDI_FILE_BYTES}-byte limit.`
		);
	}

	if (!hasMidiHeader(fileBytes)) {
		throw new MidiImportError(filename, 'is not a Standard MIDI File.');
	}

	let midi: MidiFile;
	try {
		midi = new Midi(fileBytes);
	} catch (cause) {
		throw new MidiImportError(filename, 'could not be parsed as a Standard MIDI File.', cause);
	}

	let scannedMidiFile: ScannedMidiFile | undefined;
	try {
		scannedMidiFile = scanMidiEvents(fileBytes);
	} catch {
		// Scanner failures are deliberately non-fatal because Tone is the parsing authority.
	}

	return { midi, scannedMidiFile };
}

function parsedTrackName(name: string, trackIndex: number): string {
	const trimmedName = name.trim();
	return trimmedName === '' ? `Track ${trackIndex + 1}` : trimmedName;
}

function addScannedEventWarnings(input: {
	scannedEvents: readonly ScannedEvent[];
	sourceFilename: string;
	trackName: string;
	trackIndex: number;
	warnings: MidiWarningCollector;
}): void {
	const { scannedEvents, sourceFilename, trackName, trackIndex, warnings } = input;
	for (const scannedEvent of scannedEvents) {
		const classification = classifyScannedEvent(scannedEvent.eventType);
		if (classification.supported || isSilentlyIgnoredEventType(scannedEvent.eventType)) continue;

		warnings.add({
			sourceFilename,
			trackName,
			trackIndex,
			eventType: scannedEvent.eventType,
			tick: scannedEvent.firstTick,
			count: scannedEvent.count,
			message: (count) =>
				`Ignored ${count} "${scannedEvent.eventType}" event${count === 1 ? '' : 's'}. ${ignoredEventMessage(classification)}`,
			suggestedAction: classification.suggestedAction
		});
	}
}

function attributeScannedEvents(
	midi: MidiFile,
	scannedMidiFile: ScannedMidiFile | undefined
): ScannedEventAttribution {
	const eventsByParsedTrack = midi.tracks.map((): ScannedEvent[] => []);
	const fileLevelEvents: ScannedEvent[] = [];
	if (scannedMidiFile === undefined)
		return { eventsByParsedTrack, fileLevelEvents, complete: false };

	const totalGroupCount = scannedMidiFile.chunks.reduce(
		(total, scannedChunk) => total + scannedChunk.groupCount,
		0
	);
	const formatOneShift =
		scannedMidiFile.format === 1 && totalGroupCount === midi.tracks.length + 1 ? 1 : 0;
	if (totalGroupCount !== midi.tracks.length + formatOneShift) {
		return {
			eventsByParsedTrack,
			fileLevelEvents: scannedMidiFile.chunks.flatMap((scannedChunk) => scannedChunk.events),
			complete: false
		};
	}

	let complete = scannedMidiFile.complete;
	let baseTrackIndex = 0;
	for (const scannedChunk of scannedMidiFile.chunks) {
		const hasOutOfRangeEvent = scannedChunk.events.some((scannedEvent) => {
			const parsedTrackIndex = baseTrackIndex + scannedEvent.groupIndex - formatOneShift;
			const isDroppedConductorEvent =
				formatOneShift === 1 && baseTrackIndex === 0 && scannedEvent.groupIndex === 0;
			return (
				!isDroppedConductorEvent && (parsedTrackIndex < 0 || parsedTrackIndex >= midi.tracks.length)
			);
		});
		if (!scannedChunk.complete || hasOutOfRangeEvent) {
			fileLevelEvents.push(...scannedChunk.events);
			complete = false;
		} else {
			for (const scannedEvent of scannedChunk.events) {
				const parsedTrackIndex = baseTrackIndex + scannedEvent.groupIndex - formatOneShift;
				if (parsedTrackIndex === -1 && formatOneShift === 1 && baseTrackIndex === 0) {
					fileLevelEvents.push(scannedEvent);
				} else {
					eventsByParsedTrack[parsedTrackIndex]?.push(scannedEvent);
				}
			}
		}
		baseTrackIndex += scannedChunk.groupCount;
	}

	return { eventsByParsedTrack, fileLevelEvents, complete };
}

function addEventScanIncompleteWarning(
	warnings: MidiWarningCollector,
	sourceFilename: string
): void {
	warnings.add({
		sourceFilename,
		trackName: 'Header',
		trackIndex: -1,
		eventType: 'eventScanIncomplete',
		tick: 0,
		message: () =>
			'Could not inspect every MIDI event safely. Re-export this file from your DAW before relying on the unsupported-event warnings.',
		suggestedAction: 'Re-export the MIDI file from your DAW and import it again.'
	});
}

function makeSuggestions(input: {
	tracks: ReadonlyArray<{
		id: string;
		trackIndex: number;
		sourceTrackName: string;
		midiChannel: number;
		hasNotes: boolean;
		hasMarker: boolean;
	}>;
}): readonly TrackRoleSuggestion[] {
	return input.tracks.map((track) => {
		if (track.midiChannel === 9) {
			return {
				trackId: track.id,
				trackIndex: track.trackIndex,
				sourceTrackName: track.sourceTrackName,
				role: 'percussion',
				reason: 'Track uses MIDI channel 9, the General MIDI percussion channel.',
				confidence: 'high'
			};
		}

		if (!track.hasNotes && track.hasMarker) {
			return {
				trackId: track.id,
				trackIndex: track.trackIndex,
				sourceTrackName: track.sourceTrackName,
				role: 'metadata',
				reason: 'Track contains marker events and no note events.',
				confidence: 'high'
			};
		}

		const suggestion = suggestRoleForTrackName(track.sourceTrackName);
		return {
			trackId: track.id,
			trackIndex: track.trackIndex,
			sourceTrackName: track.sourceTrackName,
			...suggestion
		};
	});
}

export function compileMidiFile(input: {
	fileBytes: ArrayBuffer;
	filename: string;
	songId?: string;
}): MidiCompileResult {
	const { fileBytes, filename, songId = crypto.randomUUID() } = input;
	const { midi, scannedMidiFile } = parseMidiFile(fileBytes, filename);
	if (!midi.tracks.some((track) => track.notes.length > 0)) {
		throw new MidiImportError(filename, 'contains no note events.');
	}

	if (!Number.isInteger(midi.header.ppq) || midi.header.ppq <= 0) {
		throw new MidiImportError(
			filename,
			'has a missing, zero, or non-integer ticks-per-quarter-note value.'
		);
	}

	const warnings = new MidiWarningCollector();
	const scannedEventAttribution = attributeScannedEvents(midi, scannedMidiFile);
	if (!scannedEventAttribution.complete) addEventScanIncompleteWarning(warnings, filename);
	const normalized = normalizeMidi({
		midi,
		sourceFilename: filename,
		songId,
		scannedEventsByTrack: scannedEventAttribution.eventsByParsedTrack,
		inspectionComplete: scannedEventAttribution.complete,
		warnings
	});

	for (let trackIndex = 0; trackIndex < midi.tracks.length; trackIndex += 1) {
		const scannedEvents = scannedEventAttribution.eventsByParsedTrack[trackIndex];
		if (scannedEvents === undefined) continue;
		const track = midi.tracks[trackIndex];
		if (track === undefined) continue;
		addScannedEventWarnings({
			scannedEvents,
			sourceFilename: filename,
			trackName: parsedTrackName(track.name, trackIndex),
			trackIndex,
			warnings
		});
	}

	addScannedEventWarnings({
		scannedEvents: scannedEventAttribution.fileLevelEvents,
		sourceFilename: filename,
		trackName: 'Header',
		trackIndex: -1,
		warnings
	});

	const song = parseOrThrow(
		CompiledSongSchema,
		normalized.song,
		`Compiled song from "${filename}"`
	);
	return {
		song,
		warnings: warnings.toWarnings(),
		suggestions: makeSuggestions({ tracks: normalized.tracks })
	};
}
