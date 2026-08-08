import type { BuilderProject } from '@thinkbreak/audio-runtime';
import { BuilderProjectSchema } from '../schemas/index.js';

export interface CreateEmptyProjectInput {
	name: string;
	nowMs?: number;
	idGenerator?: () => string;
}

export function createEmptyProject(input: CreateEmptyProjectInput): BuilderProject {
	const nowMs = input.nowMs ?? Date.now();
	const idGenerator = input.idGenerator ?? (() => crypto.randomUUID());
	const project: BuilderProject = {
		schemaVersion: 1,
		id: idGenerator(),
		name: input.name,
		createdAtMs: nowMs,
		updatedAtMs: nowMs,
		sync: {
			serverRevision: null,
			hasUnsyncedChanges: true,
			lastSyncedAtMs: null
		},
		sourceMidi: null,
		song: null,
		channels: [],
		transport: {
			loopEnabled: false,
			loopStartTick: 0,
			loopEndTick: 0,
			tempoMultiplier: 1
		},
		master: {
			gain: 0.8,
			compressor: {
				enabled: true,
				thresholdDb: -12,
				kneeDb: 6,
				ratio: 4,
				attackSeconds: 0.003,
				releaseSeconds: 0.25
			}
		},
		exportSettings: {
			packageName: 'thinkbreak-audio-export',
			includeTests: true,
			includeExample: true
		}
	};

	return BuilderProjectSchema.parse(project);
}
