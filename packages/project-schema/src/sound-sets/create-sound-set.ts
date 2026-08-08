import type { BuilderProject } from '@thinkbreak/audio-runtime';
import { SoundSetSchema, type SoundSet } from '../schemas/index.js';

export function createSoundSetFromProject(input: {
	project: BuilderProject;
	name: string;
	nowMs?: number;
	id?: string;
}): SoundSet {
	if (input.project.channels.length === 0) {
		throw new Error(`Unable to create sound set "${input.name}": the project has no channels.`);
	}

	const nowMs = input.nowMs ?? Date.now();
	return SoundSetSchema.parse({
		schemaVersion: 1,
		id: input.id ?? crypto.randomUUID(),
		name: input.name,
		builtIn: false,
		channels: input.project.channels.map(({ name, role, enabled, instrument, mix }) => ({
			name,
			role,
			enabled,
			instrument: structuredClone(instrument),
			mix: { ...mix }
		})),
		master: structuredClone(input.project.master),
		createdAtMs: nowMs,
		updatedAtMs: nowMs
	});
}
