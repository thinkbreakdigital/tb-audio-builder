import type {
	AudioChannelDefinition,
	BuilderProject,
	ChannelMixSettings
} from '@thinkbreak/audio-runtime';
import { BuilderProjectSchema, createEmptyProject, parseOrThrow } from '@thinkbreak/project-schema';

const PROJECT_NAME_MAX_LENGTH = 120;

/**
 * Solo/mute resolution rule, defined once here (04-app-shell.md §4.5) and reused by every later
 * phase that renders or plays a channel.
 */
export function isChannelAudible(
	channel: AudioChannelDefinition,
	soloedChannelIds: readonly string[]
): boolean {
	return (
		channel.enabled && !channel.mix.muted && (soloedChannelIds.length === 0 || channel.mix.soloed)
	);
}

let project = $state<BuilderProject | null>(null);

const channelList = $derived(project?.channels ?? []);
const soloedChannelIdList = $derived(
	channelList.filter((channel) => channel.mix.soloed).map((channel) => channel.id)
);
const isDirty = $derived(project?.sync.hasUnsyncedChanges ?? false);

function requireProject(action: string): BuilderProject {
	if (project === null) {
		throw new Error(`Unable to ${action}: no project is open.`);
	}
	return project;
}

function touch(target: BuilderProject): void {
	target.updatedAtMs = Date.now();
	target.sync.hasUnsyncedChanges = true;
}

function snapshotProject(source: BuilderProject): BuilderProject {
	// `$state.snapshot` intentionally creates a non-reactive plain object. `structuredClone` cannot
	// safely clone Svelte's reactive proxy, and schema validation must never observe live state.
	return $state.snapshot(source);
}

function setValidatedProject(next: BuilderProject | null, context: string): void {
	project = next === null ? null : parseOrThrow(BuilderProjectSchema, next, context);
}

function mutateProject(
	action: string,
	change: (candidate: BuilderProject) => void,
	options: { touch?: boolean } = {}
): void {
	const candidate = snapshotProject(requireProject(action));
	change(candidate);
	if (options.touch !== false) touch(candidate);
	setValidatedProject(candidate, `Unable to ${action}: resulting project is invalid`);
}

export function normalizeProjectName(name: string): string {
	const normalized = name.trim();
	if (normalized.length === 0) {
		throw new Error('Project name cannot be blank.');
	}
	if (normalized.length > PROJECT_NAME_MAX_LENGTH) {
		throw new Error(`Project name must be ${PROJECT_NAME_MAX_LENGTH} characters or fewer.`);
	}
	return normalized;
}

export const projectState = {
	get project(): BuilderProject | null {
		return project;
	},
	get isDirty(): boolean {
		return isDirty;
	},
	get channels(): readonly AudioChannelDefinition[] {
		return channelList;
	},
	get soloedChannelIds(): readonly string[] {
		return soloedChannelIdList;
	},

	/** A non-reactive copy for external validators and transactional callers. */
	snapshot(): BuilderProject | null {
		return project === null ? null : snapshotProject(project);
	},

	setProject(next: BuilderProject | null): void {
		setValidatedProject(next, 'Unable to set project');
	},

	createNew(name: string): void {
		setValidatedProject(
			createEmptyProject({ name: normalizeProjectName(name) }),
			'Unable to create project'
		);
	},

	rename(name: string): void {
		const normalizedName = normalizeProjectName(name);
		mutateProject('rename the project', (candidate) => {
			candidate.name = normalizedName;
		});
	},

	updateChannel(channelId: string, patch: Partial<AudioChannelDefinition>): void {
		mutateProject('update channel', (candidate) => {
			let found = false;
			const updated = candidate.channels.map((channel) => {
				if (channel.id !== channelId) return channel;
				found = true;
				return { ...channel, ...patch, id: channel.id };
			});
			if (!found) {
				throw new Error(
					`Unable to update channel: no channel with id "${channelId}" exists in the current project.`
				);
			}
			candidate.channels = updated;
		});
	},

	updateChannelMix(channelId: string, patch: Partial<ChannelMixSettings>): void {
		mutateProject('update channel mix', (candidate) => {
			let found = false;
			const updated = candidate.channels.map((channel) => {
				if (channel.id !== channelId) return channel;
				found = true;
				return { ...channel, mix: { ...channel.mix, ...patch } };
			});
			if (!found) {
				throw new Error(
					`Unable to update channel mix: no channel with id "${channelId}" exists in the current project.`
				);
			}
			candidate.channels = updated;
		});
	},

	replaceChannels(channels: AudioChannelDefinition[]): void {
		mutateProject('replace channels', (candidate) => {
			candidate.channels = channels;
		});
	},

	updateTransport(patch: Partial<BuilderProject['transport']>): void {
		mutateProject('update transport', (candidate) => {
			candidate.transport = { ...candidate.transport, ...patch };
		});
	},

	updateMaster(patch: Partial<BuilderProject['master']>): void {
		mutateProject('update master', (candidate) => {
			candidate.master = { ...candidate.master, ...patch };
		});
	},

	markSaved(atMs: number): void {
		mutateProject(
			'mark project saved',
			(candidate) => {
				candidate.sync.hasUnsyncedChanges = false;
				candidate.sync.lastSyncedAtMs = atMs;
			},
			{ touch: false }
		);
	}
};
