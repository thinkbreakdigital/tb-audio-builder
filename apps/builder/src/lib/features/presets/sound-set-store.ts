import type { AudioChannelDefinition, BuilderProject } from '@thinkbreak/audio-runtime';
import {
	applySoundSet,
	BuilderProjectSchema,
	createSoundSetFromProject,
	planSoundSetApply,
	SoundSetSchema,
	type SoundSet,
	type SoundSetApplyPlan
} from '@thinkbreak/project-schema';

export { pairByNameThenPosition } from '@thinkbreak/project-schema';

const MAX_SOUND_SETS = 100;

export type SoundSetApplyPreview = SoundSetApplyPlan;

export interface SoundSetStore {
	list(): SoundSet[];
	get(id: string): SoundSet | null;
	save(input: { name: string; project: BuilderProject }): SoundSet;
	remove(id: string): void;
}

function normalizeSoundSetName(name: string): string {
	const normalized = name.trim();
	if (normalized.length === 0) throw new Error('Sound set name cannot be blank.');
	if (normalized.length > 200) throw new Error('Sound set name must be 200 characters or fewer.');
	return normalized;
}

function cloneSoundSet(soundSet: SoundSet): SoundSet {
	return structuredClone(SoundSetSchema.parse(soundSet));
}

export function previewSoundSetApply(input: {
	soundSet: SoundSet;
	channels: readonly AudioChannelDefinition[];
}): SoundSetApplyPreview {
	const soundSet = SoundSetSchema.parse(input.soundSet);
	return planSoundSetApply({ soundSet, channels: input.channels });
}

/**
 * Builds one validated replacement project without mutating input. The caller owns the one
 * project-state commit and subsequent engine sync. All song/source/transport/export/sync fields
 * are copied unchanged; matched channel and source IDs are retained.
 */
export function applySoundSetToProject(input: { project: BuilderProject; soundSet: SoundSet }): {
	project: BuilderProject;
	preview: SoundSetApplyPreview;
} {
	const soundSet = SoundSetSchema.parse(input.soundSet);
	const applied = applySoundSet({ soundSet, channels: input.project.channels });
	const project = BuilderProjectSchema.parse({
		...input.project,
		channels: applied.channels,
		master: applied.master
	});
	return {
		project,
		preview: applied.plan
	};
}

export function createSoundSetStore(
	options: {
		idGenerator?: () => string;
		nowMs?: () => number;
	} = {}
): SoundSetStore {
	const idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
	const nowMs = options.nowMs ?? (() => Date.now());
	const soundSets = new Map<string, SoundSet>();

	return {
		list(): SoundSet[] {
			return [...soundSets.values()]
				.sort(
					(left, right) => right.updatedAtMs - left.updatedAtMs || left.id.localeCompare(right.id)
				)
				.map(cloneSoundSet);
		},

		get(id: string): SoundSet | null {
			const soundSet = soundSets.get(id);
			return soundSet === undefined ? null : cloneSoundSet(soundSet);
		},

		save(input): SoundSet {
			const name = normalizeSoundSetName(input.name);
			if (soundSets.size >= MAX_SOUND_SETS) {
				throw new Error(
					`Cannot save sound set: the in-memory limit of ${MAX_SOUND_SETS} sound sets was reached.`
				);
			}
			const id = idGenerator();
			if (soundSets.has(id)) {
				throw new Error(`Cannot save sound set: generated id "${id}" already exists.`);
			}
			const soundSet = createSoundSetFromProject({
				project: input.project,
				name,
				id,
				nowMs: nowMs()
			});
			soundSets.set(soundSet.id, soundSet);
			return cloneSoundSet(soundSet);
		},

		remove(id: string): void {
			if (!soundSets.delete(id)) throw new Error(`Cannot delete: sound set "${id}" was not found.`);
		}
	};
}

export const soundSetStore = createSoundSetStore();
