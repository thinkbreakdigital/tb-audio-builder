import type {
	AudioChannelDefinition,
	BuilderProject,
	ChannelMixSettings
} from '@thinkbreak/audio-runtime';
import { createEmptyProject } from '@thinkbreak/project-schema';

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

	setProject(next: BuilderProject | null): void {
		project = next;
	},

	createNew(name: string): void {
		project = createEmptyProject({ name });
	},

	rename(name: string): void {
		const current = requireProject('rename the project');
		current.name = name;
		touch(current);
	},

	updateChannel(channelId: string, patch: Partial<AudioChannelDefinition>): void {
		const current = requireProject('update channel');
		let found = false;
		const updated = current.channels.map((channel) => {
			if (channel.id !== channelId) return channel;
			found = true;
			return { ...channel, ...patch, id: channel.id };
		});
		if (!found) {
			throw new Error(
				`Unable to update channel: no channel with id "${channelId}" exists in the current project.`
			);
		}
		current.channels = updated;
		touch(current);
	},

	updateChannelMix(channelId: string, patch: Partial<ChannelMixSettings>): void {
		const current = requireProject('update channel mix');
		let found = false;
		const updated = current.channels.map((channel) => {
			if (channel.id !== channelId) return channel;
			found = true;
			return { ...channel, mix: { ...channel.mix, ...patch } };
		});
		if (!found) {
			throw new Error(
				`Unable to update channel mix: no channel with id "${channelId}" exists in the current project.`
			);
		}
		current.channels = updated;
		touch(current);
	},

	replaceChannels(channels: AudioChannelDefinition[]): void {
		const current = requireProject('replace channels');
		current.channels = channels;
		touch(current);
	},

	updateTransport(patch: Partial<BuilderProject['transport']>): void {
		const current = requireProject('update transport');
		current.transport = { ...current.transport, ...patch };
		touch(current);
	},

	updateMaster(patch: Partial<BuilderProject['master']>): void {
		const current = requireProject('update master');
		current.master = { ...current.master, ...patch };
		touch(current);
	},

	markSaved(atMs: number): void {
		const current = requireProject('mark project saved');
		current.sync.hasUnsyncedChanges = false;
		current.sync.lastSyncedAtMs = atMs;
	}
};
