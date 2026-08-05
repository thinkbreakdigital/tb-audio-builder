import type { BuilderProject, PitchedInstrumentDefinition } from '@thinkbreak/audio-runtime';
import { describe, expect, test } from 'vitest';
import {
	BuilderProjectSchema,
	CompiledSongSchema,
	PercussionInstrumentDefinitionSchema,
	PitchedInstrumentDefinitionSchema,
	ProjectValidationError,
	createEmptyProject,
	parseOrThrow
} from '../src';

const SONG_ID = '00000000-0000-4000-8000-000000000020';
const TRACK_ID = '00000000-0000-4000-8000-000000000021';
const CHANNEL_ID = '00000000-0000-4000-8000-000000000022';

function pitched(): PitchedInstrumentDefinition {
	return {
		kind: 'pitched',
		presetId: null,
		oscillator: { waveform: 'square', octaveOffset: 0, semitoneOffset: 0, fineDetuneCents: 0 },
		amplitudeEnvelope: {
			attackSeconds: 0,
			decaySeconds: 2,
			sustainLevel: 1,
			releaseSeconds: 5
		},
		filter: { enabled: true, type: 'lowpass', frequencyHz: 20_000, q: 20 },
		modulation: {
			vibratoEnabled: true,
			vibratoRateHz: 20,
			vibratoDepthCents: 100,
			pitchBendRangeSemitones: 24
		},
		voice: { polyphonic: true, maxVoices: 8, stealMode: 'oldest' }
	};
}

function song() {
	return {
		schemaVersion: 1,
		id: SONG_ID,
		sourceFilename: 'source.mid',
		ticksPerQuarterNote: 480,
		durationTicks: 10,
		tempoChanges: [
			{ tick: 0, bpm: 120 },
			{ tick: 10, bpm: 140 }
		],
		timeSignatures: [
			{ tick: 0, numerator: 4, denominator: 4 },
			{ tick: 10, numerator: 3, denominator: 4 }
		],
		markers: [],
		tracks: [
			{
				id: TRACK_ID,
				sourceTrackName: 'Lead',
				midiChannel: 15,
				notes: [
					{ tick: 0, durationTicks: 1, midiNote: 0, velocity: 0 },
					{ tick: 10, durationTicks: 2, midiNote: 127, velocity: 1 }
				],
				pitchBends: [
					{ tick: 0, value: -1 },
					{ tick: 10, value: 1 }
				],
				modulationEvents: [],
				volumeEvents: []
			}
		]
	};
}

function project(): BuilderProject {
	const value = createEmptyProject({
		name: 'Project',
		nowMs: 1,
		idGenerator: () => '00000000-0000-4000-8000-000000000023'
	});
	value.song = song();
	value.channels = [
		{
			id: CHANNEL_ID,
			name: 'Lead',
			role: 'pitched',
			sourceTrackId: TRACK_ID,
			enabled: true,
			instrument: pitched(),
			mix: { gain: 1, pan: -1, muted: false, soloed: false }
		}
	];
	value.transport.tempoMultiplier = 4;
	return value;
}

describe('schemas', () => {
	test('valid minimal and maximal documents parse', () => {
		expect(BuilderProjectSchema.parse(createEmptyProject({ name: 'Minimal' })).name).toBe(
			'Minimal'
		);
		expect(BuilderProjectSchema.parse(project()).channels[0]?.instrument?.kind).toBe('pitched');
	});

	test.each([
		[
			'gain',
			0,
			-0.001,
			1,
			1.001,
			(value: number) => ({ ...project(), master: { ...project().master, gain: value } }),
			BuilderProjectSchema
		],
		[
			'pan',
			-1,
			-1.001,
			1,
			1.001,
			(value: number) => {
				const valueProject = project();
				valueProject.channels[0]!.mix.pan = value;
				return valueProject;
			},
			BuilderProjectSchema
		],
		[
			'tempoMultiplier',
			0.25,
			0.249,
			4,
			4.001,
			(value: number) => {
				const valueProject = project();
				valueProject.transport.tempoMultiplier = value;
				return valueProject;
			},
			BuilderProjectSchema
		],
		[
			'sustainLevel',
			0,
			-0.001,
			1,
			1.001,
			(value: number) => ({
				...pitched(),
				amplitudeEnvelope: { ...pitched().amplitudeEnvelope, sustainLevel: value }
			}),
			PitchedInstrumentDefinitionSchema
		],
		[
			'filterFrequencyHz',
			20,
			19.999,
			20_000,
			20_000.001,
			(value: number) => ({
				kind: 'percussion',
				presetId: null,
				oscillatorLayer: {
					enabled: true,
					waveform: 'sine',
					startFrequencyHz: 20,
					endFrequencyHz: 8000,
					pitchDecaySeconds: 1,
					attackSeconds: 0.5,
					decaySeconds: 2,
					sustainLevel: 1,
					releaseSeconds: 2,
					gain: 1
				},
				noiseLayer: {
					enabled: true,
					filterType: 'bandpass',
					filterFrequencyHz: value,
					filterQ: 20,
					attackSeconds: 0.5,
					decaySeconds: 2,
					sustainLevel: 1,
					releaseSeconds: 2,
					gain: 1
				},
				chokeGroup: null
			}),
			PercussionInstrumentDefinitionSchema
		],
		[
			'pitchBendRangeSemitones',
			0,
			-0.001,
			24,
			24.001,
			(value: number) => ({
				...pitched(),
				modulation: { ...pitched().modulation, pitchBendRangeSemitones: value }
			}),
			PitchedInstrumentDefinitionSchema
		],
		[
			'maxVoices',
			1,
			0,
			8,
			9,
			(value: number) => ({ ...pitched(), voice: { ...pitched().voice, maxVoices: value } }),
			PitchedInstrumentDefinitionSchema
		]
	] as const)(
		'%s enforces both inclusive boundaries',
		(_name, min, below, max, above, make, schema) => {
			expect(schema.safeParse(make(min)).success).toBe(true);
			expect(schema.safeParse(make(below)).success).toBe(false);
			expect(schema.safeParse(make(max)).success).toBe(true);
			expect(schema.safeParse(make(above)).success).toBe(false);
		}
	);

	test.each([
		['notes', (value: ReturnType<typeof song>) => value.tracks[0]!.notes.reverse()],
		['tempoChanges', (value: ReturnType<typeof song>) => value.tempoChanges.reverse()],
		['timeSignatures', (value: ReturnType<typeof song>) => value.timeSignatures.reverse()],
		['pitchBends', (value: ReturnType<typeof song>) => value.tracks[0]!.pitchBends.reverse()]
	])('unsorted %s names its offending index', (name, disorder) => {
		const value = song();
		disorder(value);
		const result = CompiledSongSchema.safeParse(value);
		expect(result.success ? '' : result.error.message).toContain(
			`${name} is out of order at index 1`
		);
	});

	test('requires a tempo change at tick zero', () => {
		const value = song();
		value.tempoChanges = [{ tick: 1, bpm: 120 }];
		expect(CompiledSongSchema.safeParse(value).success).toBe(false);
	});

	test('rejects invalid loop order and missing source tracks', () => {
		const invalidLoop = project();
		invalidLoop.transport.loopStartTick = 2;
		invalidLoop.transport.loopEndTick = 1;
		expect(BuilderProjectSchema.safeParse(invalidLoop).success).toBe(false);
		const invalidTrack = project();
		invalidTrack.channels[0]!.sourceTrackId = '00000000-0000-4000-8000-000000000099';
		expect(BuilderProjectSchema.safeParse(invalidTrack).success).toBe(false);
	});

	test('rejects unknown keys and reports every validation path', () => {
		const extra = { ...project(), unexpected: true };
		expect(BuilderProjectSchema.safeParse(extra).success).toBe(false);
		const invalid = project();
		invalid.channels[0]!.mix.gain = 2;
		invalid.transport.tempoMultiplier = 5;
		expect(() => parseOrThrow(BuilderProjectSchema, invalid, 'Invalid builder project')).toThrow(
			ProjectValidationError
		);
		try {
			parseOrThrow(BuilderProjectSchema, invalid, 'Invalid builder project');
		} catch (error) {
			expect((error as ProjectValidationError).message).toContain('channels.0.mix.gain');
			expect((error as ProjectValidationError).message).toContain('transport.tempoMultiplier');
		}
	});
});
