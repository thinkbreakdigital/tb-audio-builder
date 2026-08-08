import type {
	AudioChannelDefinition,
	BuilderProject,
	PitchedInstrumentDefinition
} from '@thinkbreak/audio-runtime';
import { describe, expect, test } from 'vitest';
import {
	SoundSetSchema,
	applySoundSet,
	createEmptyProject,
	createSoundSetFromProject,
	pairByNameThenPosition,
	planSoundSetApply
} from '../src';

function instrument(): PitchedInstrumentDefinition {
	return {
		kind: 'pitched',
		presetId: 'square-lead',
		oscillator: { waveform: 'square', octaveOffset: 0, semitoneOffset: 0, fineDetuneCents: 0 },
		amplitudeEnvelope: {
			attackSeconds: 0.1,
			decaySeconds: 0.2,
			sustainLevel: 0.8,
			releaseSeconds: 0.4
		},
		filter: { enabled: true, type: 'lowpass', frequencyHz: 1000, q: 1 },
		modulation: {
			vibratoEnabled: false,
			vibratoRateHz: 5,
			vibratoDepthCents: 10,
			pitchBendRangeSemitones: 2
		},
		voice: { polyphonic: true, maxVoices: 4, stealMode: 'oldest' }
	};
}

function channel(index: number, name: string): AudioChannelDefinition {
	return {
		id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
		name,
		role: 'pitched',
		sourceTrackId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
		enabled: true,
		instrument: instrument(),
		mix: { gain: 0.8, pan: 0, muted: false, soloed: false }
	};
}

function projectWithChannels(names = ['Lead', 'Bass']): BuilderProject {
	const project = createEmptyProject({
		name: 'Composition sentinel',
		nowMs: 10,
		idGenerator: () => '20000000-0000-4000-8000-000000000001'
	});
	project.channels = names.map((name, index) => channel(index + 1, name));
	project.sourceMidi = { filename: 'midi-sentinel.mid', byteLength: 42, sha256: 'a'.repeat(64) };
	project.transport = {
		loopEnabled: true,
		loopStartTick: 111,
		loopEndTick: 999,
		tempoMultiplier: 2
	};
	project.exportSettings = {
		packageName: 'export-sentinel',
		includeTests: false,
		includeExample: false
	};
	return project;
}

describe('pairByNameThenPosition', () => {
	test('name pairs win, separators are ignored, and remainders pair by position', () => {
		const left = [{ name: 'Other A' }, { name: 'NOISE_KICK' }, { name: 'Other B' }];
		const right = [{ name: 'noise kick' }, { name: 'Saved A' }, { name: 'Saved B' }];
		const result = pairByNameThenPosition(left, right);
		expect(result.pairs.map(({ left: l, right: r }) => [l.name, r.name])).toEqual([
			['NOISE_KICK', 'noise kick'],
			['Other A', 'Saved A'],
			['Other B', 'Saved B']
		]);
	});

	test('duplicate names consume each side once', () => {
		const result = pairByNameThenPosition([{ name: 'Lead' }, { name: 'Lead' }], [{ name: 'lead' }]);
		expect(result.pairs).toHaveLength(1);
		expect(result.unmatchedLeft).toHaveLength(1);
		expect(result.unmatchedRight).toEqual([]);
	});

	test('empty inputs produce empty results', () => {
		expect(pairByNameThenPosition([], [])).toEqual({
			pairs: [],
			unmatchedLeft: [],
			unmatchedRight: []
		});
	});
});

describe('sound sets', () => {
	test('creation validates and excludes every composition-specific field', () => {
		const project = projectWithChannels();
		const soundSet = createSoundSetFromProject({
			project,
			name: 'Set',
			nowMs: 20,
			id: '00000000-0000-4000-8000-000000000101'
		});
		expect(SoundSetSchema.safeParse(soundSet).success).toBe(true);
		expect(
			soundSet.channels.every((saved) => !('id' in saved) && !('sourceTrackId' in saved))
		).toBe(true);
		const serialized = JSON.stringify(soundSet);
		for (const sentinel of ['midi-sentinel.mid', 'a'.repeat(64), '111', '999', 'export-sentinel']) {
			expect(serialized).not.toContain(sentinel);
		}
	});

	test('round trips channels without sharing objects or instrument references', () => {
		const project = projectWithChannels();
		const soundSet = createSoundSetFromProject({
			project,
			name: 'Set',
			id: '00000000-0000-4000-8000-000000000102',
			nowMs: 1
		});
		const applied = applySoundSet({ soundSet, channels: project.channels });
		expect(applied.channels).toEqual(project.channels);
		expect(applied.channels[0]).not.toBe(project.channels[0]);
		const appliedInstrument = applied.channels[0]!.instrument as PitchedInstrumentDefinition;
		appliedInstrument.oscillator.waveform = 'sine';
		expect(
			(soundSet.channels[0]!.instrument as PitchedInstrumentDefinition).oscillator.waveform
		).toBe('square');
	});

	test('renamed channels fall back to position', () => {
		const source = projectWithChannels(['Lead', 'Bass']);
		const soundSet = createSoundSetFromProject({
			project: source,
			name: 'Set',
			id: '00000000-0000-4000-8000-000000000103',
			nowMs: 1
		});
		const target = projectWithChannels(['Track 1', 'Track 2']);
		const plan = planSoundSetApply({ soundSet, channels: target.channels });
		expect(plan.assignments.map(({ fromSoundSetChannel }) => fromSoundSetChannel)).toEqual([
			'Lead',
			'Bass'
		]);
	});

	test('fewer channels discard named saved channels without creating channels', () => {
		const soundSet = createSoundSetFromProject({
			project: projectWithChannels(['One', 'Two', 'Three']),
			name: 'Set',
			id: '00000000-0000-4000-8000-000000000104',
			nowMs: 1
		});
		const result = applySoundSet({ soundSet, channels: [channel(9, 'One')] });
		expect(result.channels).toHaveLength(1);
		expect(result.plan.discardedSoundSetChannels).toEqual(['Two', 'Three']);
	});

	test('extra project channels remain untouched by reference', () => {
		const soundSet = createSoundSetFromProject({
			project: projectWithChannels(['One']),
			name: 'Set',
			id: '00000000-0000-4000-8000-000000000105',
			nowMs: 1
		});
		const channels = [channel(8, 'One'), channel(9, 'Extra')];
		const result = applySoundSet({ soundSet, channels });
		expect(result.channels[1]).toBe(channels[1]);
		expect(result.plan.unchangedChannelIds).toEqual([channels[1]!.id]);
	});

	test('applies master wholesale and returns no arrangement fields', () => {
		const source = projectWithChannels(['One']);
		source.master.gain = 0.25;
		const soundSet = createSoundSetFromProject({
			project: source,
			name: 'Set',
			id: '00000000-0000-4000-8000-000000000106',
			nowMs: 1
		});
		const result = applySoundSet({ soundSet, channels: source.channels });
		expect(result.master).toEqual(soundSet.master);
		expect(result).not.toHaveProperty('song');
		expect(result).not.toHaveProperty('transport');
		expect(result).not.toHaveProperty('exportSettings');
	});
});
