import type { BuilderProject, PitchedInstrumentDefinition } from '@thinkbreak/audio-runtime';
import { describe, expect, test } from 'vitest';
import {
	BuilderProjectSchema,
	CompiledSongSchema,
	InstrumentPresetSchema,
	PercussionInstrumentDefinitionSchema,
	PitchedInstrumentDefinitionSchema,
	ProjectValidationError,
	SoundSetSchema,
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
					{ tick: 8, durationTicks: 2, midiNote: 127, velocity: 1 }
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
	value.transport = { loopEnabled: true, loopStartTick: 0, loopEndTick: 10, tempoMultiplier: 4 };
	return value;
}

function percussion() {
	return {
		kind: 'percussion' as const,
		presetId: null,
		oscillatorLayer: {
			enabled: true,
			pitchTracksNote: false,
			waveform: 'sine' as const,
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
			filterTracksNote: false,
			filterType: 'bandpass' as const,
			filterFrequencyHz: 20_000,
			filterQ: 20,
			attackSeconds: 0.5,
			decaySeconds: 2,
			sustainLevel: 1,
			releaseSeconds: 2,
			gain: 1
		},
		rootMidiNote: 60,
		chokeGroup: null
	};
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
					pitchTracksNote: false,
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
					filterTracksNote: false,
					filterType: 'bandpass',
					filterFrequencyHz: value,
					filterQ: 20,
					attackSeconds: 0.5,
					decaySeconds: 2,
					sustainLevel: 1,
					releaseSeconds: 2,
					gain: 1
				},
				rootMidiNote: 60,
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

	test('enforces the role and instrument matrix', () => {
		const cases = [
			['pitched', null],
			['pitched', percussion()],
			['percussion', null],
			['percussion', pitched()],
			['ignored', pitched()],
			['metadata', percussion()]
		] as const;
		for (const [role, instrument] of cases) {
			const value = project();
			value.channels[0] = {
				...value.channels[0]!,
				role,
				instrument
			} as (typeof value.channels)[number];
			expect(BuilderProjectSchema.safeParse(value).success).toBe(false);
		}
	});

	test('enforces duration bounds for every song position and note end', () => {
		const mutations: ((value: ReturnType<typeof song>) => void)[] = [
			(value) => {
				value.tempoChanges[1]!.tick = 11;
			},
			(value) => {
				value.timeSignatures[1]!.tick = 11;
			},
			(value) => {
				value.markers = [{ tick: 11, name: 'Late' }];
			},
			(value) => {
				value.tracks[0]!.notes[1]!.durationTicks = 3;
			},
			(value) => {
				value.tracks[0]!.pitchBends[1]!.tick = 11;
			},
			(value) => {
				value.tracks[0]!.modulationEvents = [{ tick: 11, value: 1 }];
			},
			(value) => {
				value.tracks[0]!.volumeEvents = [{ tick: 11, value: 1 }];
			}
		];
		for (const mutate of mutations) {
			const value = song();
			mutate(value);
			expect(CompiledSongSchema.safeParse(value).success).toBe(false);
		}
	});

	test('enforces numeric, ordered loop bounds while preserving a disabled region', () => {
		const disabledAtOrigin = project();
		disabledAtOrigin.transport = {
			loopEnabled: false,
			loopStartTick: 0,
			loopEndTick: 0,
			tempoMultiplier: 1
		};
		expect(BuilderProjectSchema.safeParse(disabledAtOrigin).success).toBe(true);
		const disabledWithBounds = project();
		disabledWithBounds.transport = {
			loopEnabled: false,
			loopStartTick: 1,
			loopEndTick: 2,
			tempoMultiplier: 1
		};
		expect(BuilderProjectSchema.safeParse(disabledWithBounds).success).toBe(true);
		const reversedDisabledLoop = project();
		reversedDisabledLoop.transport = {
			loopEnabled: false,
			loopStartTick: 2,
			loopEndTick: 1,
			tempoMultiplier: 1
		};
		expect(BuilderProjectSchema.safeParse(reversedDisabledLoop).success).toBe(false);
		const outOfBoundsDisabledLoop = project();
		outOfBoundsDisabledLoop.transport = {
			loopEnabled: false,
			loopStartTick: 1,
			loopEndTick: 11,
			tempoMultiplier: 1
		};
		expect(BuilderProjectSchema.safeParse(outOfBoundsDisabledLoop).success).toBe(false);

		const emptySongLoop = project();
		emptySongLoop.song = {
			...emptySongLoop.song!,
			durationTicks: 0,
			tempoChanges: [emptySongLoop.song!.tempoChanges[0]!],
			timeSignatures: [emptySongLoop.song!.timeSignatures[0]!],
			markers: [],
			tracks: []
		};
		emptySongLoop.channels = [];
		emptySongLoop.transport = {
			loopEnabled: true,
			loopStartTick: 0,
			loopEndTick: 0,
			tempoMultiplier: 1
		};
		expect(BuilderProjectSchema.safeParse(emptySongLoop).success).toBe(true);
		const outOfBoundsLoop = project();
		outOfBoundsLoop.transport.loopEndTick = 11;
		expect(BuilderProjectSchema.safeParse(outOfBoundsLoop).success).toBe(false);
		const loopWithoutSong = createEmptyProject({ name: 'No song' });
		loopWithoutSong.transport = {
			loopEnabled: true,
			loopStartTick: 0,
			loopEndTick: 1,
			tempoMultiplier: 1
		};
		expect(BuilderProjectSchema.safeParse(loopWithoutSong).success).toBe(false);
		const boundsWithoutSong = createEmptyProject({ name: 'No song' });
		boundsWithoutSong.transport = {
			loopEnabled: false,
			loopStartTick: 0,
			loopEndTick: 1,
			tempoMultiplier: 1
		};
		expect(BuilderProjectSchema.safeParse(boundsWithoutSong).success).toBe(false);
	});

	test('rejects duplicate track/channel/source-track IDs while keeping source existence validation', () => {
		const duplicateTrack = song();
		duplicateTrack.tracks.push({ ...duplicateTrack.tracks[0]! });
		expect(CompiledSongSchema.safeParse(duplicateTrack).success).toBe(false);

		const duplicateChannel = project();
		duplicateChannel.channels.push({ ...duplicateChannel.channels[0]!, sourceTrackId: null });
		expect(BuilderProjectSchema.safeParse(duplicateChannel).success).toBe(false);

		const duplicateSource = project();
		duplicateSource.channels.push({
			...duplicateSource.channels[0]!,
			id: '00000000-0000-4000-8000-000000000024'
		});
		expect(BuilderProjectSchema.safeParse(duplicateSource).success).toBe(false);

		const missingSource = project();
		missingSource.channels[0]!.sourceTrackId = '00000000-0000-4000-8000-000000000099';
		expect(BuilderProjectSchema.safeParse(missingSource).success).toBe(false);
	});

	test('rejects blank or overlong project and channel names without trimming display names', () => {
		const blankProject = project();
		blankProject.name = ' \t ';
		expect(BuilderProjectSchema.safeParse(blankProject).success).toBe(false);
		const longChannel = project();
		longChannel.channels[0]!.name = 'x'.repeat(121);
		expect(BuilderProjectSchema.safeParse(longChannel).success).toBe(false);
		const displayName = project();
		displayName.name = '  Intentional spaces  ';
		const parsed = BuilderProjectSchema.parse(displayName);
		expect(parsed.name).toBe('  Intentional spaces  ');
	});

	test('normalizes a whitespace-only choke group and enforces preset IDs by builtIn status', () => {
		const normalized = PercussionInstrumentDefinitionSchema.parse({
			...percussion(),
			chokeGroup: ' \t '
		});
		expect(normalized.chokeGroup).toBeNull();

		const preset = {
			id: '00000000-0000-4000-8000-000000000030',
			name: 'Custom',
			type: 'pitched' as const,
			definition: pitched(),
			builtIn: false,
			createdAtMs: 1,
			updatedAtMs: 1
		};
		expect(InstrumentPresetSchema.safeParse(preset).success).toBe(true);
		expect(InstrumentPresetSchema.safeParse({ ...preset, id: 'square-lead' }).success).toBe(false);
		expect(
			InstrumentPresetSchema.safeParse({ ...preset, builtIn: true, id: 'square-lead' }).success
		).toBe(true);
		expect(InstrumentPresetSchema.safeParse({ ...preset, builtIn: true }).success).toBe(false);

		const { id: _id, sourceTrackId: _sourceTrackId, ...soundSetChannel } = project().channels[0]!;
		expect(_id).toBe(CHANNEL_ID);
		expect(_sourceTrackId).toBe(TRACK_ID);
		const soundSet = {
			schemaVersion: 1,
			id: '00000000-0000-4000-8000-000000000031',
			name: 'Set',
			builtIn: false,
			channels: [soundSetChannel, { ...soundSetChannel }],
			master: project().master,
			createdAtMs: 1,
			updatedAtMs: 1
		};
		expect(SoundSetSchema.safeParse(soundSet).success).toBe(true);
		expect(SoundSetSchema.safeParse({ ...soundSet, id: 'set' }).success).toBe(false);
		expect(SoundSetSchema.safeParse({ ...soundSet, builtIn: true, id: 'set' }).success).toBe(true);
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
