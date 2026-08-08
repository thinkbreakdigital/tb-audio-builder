/**
 * Builds a `CompiledSong` plus its channels, transport, and master sections from a compact literal,
 * so scheduler, transport, and engine tests read as the musical situation they describe rather than
 * as fixture plumbing (spec §4.11).
 *
 * The returned object is exactly the shape `AudioEngine.loadProject` takes, so an engine test is
 * `engine.loadProject(buildSong({ ... }))`.
 */

import {
	DEFAULT_CHANNEL_MIX,
	DEFAULT_COMPRESSOR,
	DEFAULT_MASTER_GAIN
} from '../../src/constants.js';
import type {
	AudioChannelDefinition,
	ChannelMixSettings,
	ChannelRole
} from '../../src/types/channel.js';
import type {
	InstrumentDefinition,
	PercussionInstrumentDefinition,
	PitchedInstrumentDefinition
} from '../../src/types/instrument.js';
import type { BuilderProject, CompressorSettings } from '../../src/types/project.js';
import type {
	CompiledNote,
	CompiledSong,
	CompiledTrack,
	PitchBendEvent,
	TempoChange
} from '../../src/types/song.js';
import { assertNever } from '../../src/util/assert-never.js';

const DEFAULT_TICKS_PER_QUARTER_NOTE = 480;
const DEFAULT_NOTE_DURATION_TICKS = 480;
const DEFAULT_MIDI_NOTE = 60;
const DEFAULT_VELOCITY = 0.8;

export interface BuildNoteInput {
	tick: number;
	durationTicks?: number;
	midiNote?: number;
	velocity?: number;
}

export interface BuildChannelInput {
	id?: string;
	name?: string;
	role?: ChannelRole; // default 'pitched'
	enabled?: boolean; // default true
	/** Defaults to a fixture matching the role; `null` makes the channel contribute no events. */
	instrument?: InstrumentDefinition | null;
	mix?: Partial<ChannelMixSettings>;
	/** Defaults to the generated track; `null` models MIDI that was removed. */
	sourceTrackId?: string | null;
	notes?: readonly BuildNoteInput[];
	/** Source-track pitch bends, sorted by tick. Empty unless a test exercises bend delivery. */
	pitchBends?: readonly PitchBendEvent[];
}

export interface BuildSongInput {
	ticksPerQuarterNote?: number; // default 480
	/** Defaults to the last note end across all channels. */
	durationTicks?: number;
	tempoChanges?: readonly TempoChange[]; // default 120 BPM at tick 0
	loop?: { enabled?: boolean; startTick?: number; endTick?: number };
	tempoMultiplier?: number;
	master?: { gain?: number; compressor?: CompressorSettings };
	channels: readonly BuildChannelInput[];
}

export interface BuiltProject {
	song: CompiledSong;
	channels: AudioChannelDefinition[];
	transport: BuilderProject['transport'];
	master: BuilderProject['master'];
}

export function makePitchedInstrument(overrides?: {
	polyphonic?: boolean;
	maxVoices?: number;
}): PitchedInstrumentDefinition {
	return {
		kind: 'pitched',
		presetId: null,
		oscillator: { waveform: 'sine', octaveOffset: 0, semitoneOffset: 0, fineDetuneCents: 0 },
		amplitudeEnvelope: {
			attackSeconds: 0.01,
			decaySeconds: 0.1,
			sustainLevel: 0.8,
			releaseSeconds: 0.2
		},
		filter: { enabled: false, type: 'lowpass', frequencyHz: 20000, q: 1 },
		modulation: {
			vibratoEnabled: false,
			vibratoRateHz: 5,
			vibratoDepthCents: 0,
			pitchBendRangeSemitones: 2
		},
		voice: {
			polyphonic: overrides?.polyphonic ?? true,
			maxVoices: overrides?.maxVoices ?? 8,
			stealMode: 'oldest'
		}
	};
}

export function makePercussionInstrument(
	chokeGroup: string | null = null
): PercussionInstrumentDefinition {
	return {
		kind: 'percussion',
		presetId: null,
		oscillatorLayer: {
			enabled: true,
			waveform: 'sine',
			startFrequencyHz: 200,
			endFrequencyHz: 60,
			pitchDecaySeconds: 0.05,
			attackSeconds: 0,
			decaySeconds: 0.1,
			sustainLevel: 0,
			releaseSeconds: 0.05,
			gain: 1
		},
		noiseLayer: {
			enabled: false,
			filterType: 'highpass',
			filterFrequencyHz: 2000,
			filterQ: 1,
			attackSeconds: 0,
			decaySeconds: 0.05,
			sustainLevel: 0,
			releaseSeconds: 0.05,
			gain: 0
		},
		chokeGroup
	};
}

/** Terse form for a regular note pattern: `notesEvery({ count: 8, stepTicks: 960 })`. */
export function notesEvery(input: {
	count: number;
	stepTicks: number;
	startTick?: number;
	durationTicks?: number;
	midiNote?: number;
	velocity?: number;
}): BuildNoteInput[] {
	const notes: BuildNoteInput[] = [];
	for (let index = 0; index < input.count; index += 1) {
		notes.push({
			tick: (input.startTick ?? 0) + index * input.stepTicks,
			durationTicks: input.durationTicks,
			midiNote: input.midiNote,
			velocity: input.velocity
		});
	}
	return notes;
}

function defaultInstrumentForRole(role: ChannelRole): InstrumentDefinition | null {
	switch (role) {
		case 'pitched':
			return makePitchedInstrument();
		case 'percussion':
			return makePercussionInstrument();
		case 'ignored':
		case 'metadata':
			return null;
		default:
			return assertNever(role, 'build-song default instrument');
	}
}

export function buildSong(input: BuildSongInput): BuiltProject {
	const ticksPerQuarterNote = input.ticksPerQuarterNote ?? DEFAULT_TICKS_PER_QUARTER_NOTE;

	const tracks: CompiledTrack[] = [];
	const channels: AudioChannelDefinition[] = [];
	let lastEndTick = 0;

	input.channels.forEach((channelInput, index) => {
		const channelId = channelInput.id ?? `ch-${index + 1}`;
		const trackId = `${channelId}-track`;
		const role = channelInput.role ?? 'pitched';

		const notes: CompiledNote[] = (channelInput.notes ?? []).map((note) => ({
			tick: note.tick,
			durationTicks: note.durationTicks ?? DEFAULT_NOTE_DURATION_TICKS,
			midiNote: note.midiNote ?? DEFAULT_MIDI_NOTE,
			velocity: note.velocity ?? DEFAULT_VELOCITY
		}));
		notes.sort((a, b) => (a.tick === b.tick ? a.midiNote - b.midiNote : a.tick - b.tick));
		for (const note of notes) lastEndTick = Math.max(lastEndTick, note.tick + note.durationTicks);

		tracks.push({
			id: trackId,
			sourceTrackName: channelInput.name ?? channelId,
			midiChannel: index,
			notes,
			pitchBends: channelInput.pitchBends ?? [],
			modulationEvents: [],
			volumeEvents: []
		});

		channels.push({
			id: channelId,
			name: channelInput.name ?? channelId,
			role,
			sourceTrackId:
				channelInput.sourceTrackId === undefined ? trackId : channelInput.sourceTrackId,
			enabled: channelInput.enabled ?? true,
			instrument:
				channelInput.instrument === undefined
					? defaultInstrumentForRole(role)
					: channelInput.instrument,
			mix: { ...DEFAULT_CHANNEL_MIX, ...channelInput.mix }
		});
	});

	const durationTicks = input.durationTicks ?? lastEndTick;

	const song: CompiledSong = {
		schemaVersion: 1,
		id: 'song-fixture',
		sourceFilename: 'fixture.mid',
		ticksPerQuarterNote,
		durationTicks,
		tempoChanges: [...(input.tempoChanges ?? [{ tick: 0, bpm: 120 }])],
		timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
		markers: [],
		tracks
	};

	return {
		song,
		channels,
		transport: {
			loopEnabled: input.loop?.enabled ?? false,
			loopStartTick: input.loop?.startTick ?? 0,
			loopEndTick: input.loop?.endTick ?? 0,
			tempoMultiplier: input.tempoMultiplier ?? 1
		},
		master: {
			gain: input.master?.gain ?? DEFAULT_MASTER_GAIN,
			compressor: input.master?.compressor ?? DEFAULT_COMPRESSOR
		}
	};
}
