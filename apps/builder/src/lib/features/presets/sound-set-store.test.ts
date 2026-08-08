import {
	createDefaultPercussionInstrument,
	createDefaultPitchedInstrument,
	type AudioChannelDefinition,
	type BuilderProject
} from '@thinkbreak/audio-runtime';
import { createEmptyProject } from '@thinkbreak/project-schema';
import { describe, expect, it } from 'vitest';
import {
	applySoundSetToProject,
	createSoundSetStore,
	pairByNameThenPosition,
	previewSoundSetApply
} from './sound-set-store.js';

function channel(input: {
	id: string;
	sourceTrackId: string;
	name: string;
	role?: 'pitched' | 'percussion';
}): AudioChannelDefinition {
	const role = input.role ?? 'pitched';
	return {
		id: input.id,
		name: input.name,
		role,
		sourceTrackId: input.sourceTrackId,
		enabled: true,
		instrument:
			role === 'pitched' ? createDefaultPitchedInstrument() : createDefaultPercussionInstrument(),
		mix: { gain: 0.8, pan: 0, muted: false, soloed: false }
	};
}

function projectWithChannels(channels: AudioChannelDefinition[]): BuilderProject {
	const project = createEmptyProject({ name: 'Sound set test' });
	return { ...project, channels };
}

describe('sound-set store', () => {
	it('saves immutable custom sound sets with normalized names', () => {
		const store = createSoundSetStore({
			idGenerator: () => '3dfe2b0e-7ba0-484a-a92a-2fd3b9242502',
			nowMs: () => 10
		});
		const source = projectWithChannels([
			channel({
				id: 'a4a90b89-8c35-4a1a-b022-751eb011a0dd',
				sourceTrackId: 'b4a90b89-8c35-4a1a-b022-751eb011a0dd',
				name: 'Kick'
			})
		]);
		const saved = store.save({ name: '  Drums  ', project: source });
		expect(saved).toMatchObject({ name: 'Drums', builtIn: false, createdAtMs: 10 });
		saved.channels[0]!.name = 'Mutated';
		expect(store.get(saved.id)?.channels[0]!.name).toBe('Kick');
		expect(() => store.save({ name: ' ', project: source })).toThrow(/cannot be blank/);
	});

	it('re-exports the shared separator-insensitive duplicate-safe pairing helper', () => {
		const pairing = pairByNameThenPosition(
			[{ name: ' Hat ' }, { name: 'Hat' }, { name: 'Bass' }, { name: 'Kick drum' }],
			[{ name: 'hat' }, { name: 'hat' }, { name: 'Snare' }, { name: 'kick-drum' }]
		);
		expect(pairing.pairs.map(({ left, right }) => [left.name, right.name])).toEqual([
			[' Hat ', 'hat'],
			['Hat', 'hat'],
			['Kick drum', 'kick-drum'],
			['Bass', 'Snare']
		]);
	});

	it('returns a pure atomic apply result while retaining project identity boundaries', () => {
		const project = projectWithChannels([
			channel({
				id: 'a4a90b89-8c35-4a1a-b022-751eb011a0dd',
				sourceTrackId: 'b4a90b89-8c35-4a1a-b022-751eb011a0dd',
				name: 'Lead'
			}),
			channel({
				id: 'c4a90b89-8c35-4a1a-b022-751eb011a0dd',
				sourceTrackId: 'd4a90b89-8c35-4a1a-b022-751eb011a0dd',
				name: 'Unused'
			})
		]);
		const store = createSoundSetStore({
			idGenerator: () => '3dfe2b0e-7ba0-484a-a92a-2fd3b9242502',
			nowMs: () => 10
		});
		const soundSet = store.save({ name: 'Source', project });
		soundSet.channels[0] = {
			...soundSet.channels[0]!,
			name: 'Lead',
			role: 'percussion',
			instrument: createDefaultPercussionInstrument()
		};
		const before = structuredClone(project);
		const result = applySoundSetToProject({ project, soundSet });

		expect(result.project.channels[0]).toMatchObject({
			id: project.channels[0]!.id,
			sourceTrackId: project.channels[0]!.sourceTrackId,
			role: 'percussion'
		});
		expect(result.project.song).toEqual(project.song);
		expect(result.project.sourceMidi).toEqual(project.sourceMidi);
		expect(result.project.transport).toEqual(project.transport);
		expect(result.project.exportSettings).toEqual(project.exportSettings);
		expect(result.project.sync).toEqual(project.sync);
		expect(project).toEqual(before);
		expect(previewSoundSetApply({ soundSet, channels: project.channels }).assignments).toHaveLength(
			2
		);
	});

	it('rejects an invalid input project instead of returning an invalid replacement', () => {
		const project = projectWithChannels([
			channel({
				id: 'a4a90b89-8c35-4a1a-b022-751eb011a0dd',
				sourceTrackId: 'b4a90b89-8c35-4a1a-b022-751eb011a0dd',
				name: 'Lead'
			})
		]);
		const store = createSoundSetStore({
			idGenerator: () => '3dfe2b0e-7ba0-484a-a92a-2fd3b9242502',
			nowMs: () => 10
		});
		const soundSet = store.save({ name: 'Source', project });
		const invalid = structuredClone(project);
		invalid.name = '   ';

		expect(() => applySoundSetToProject({ project: invalid, soundSet })).toThrow();
	});
});
