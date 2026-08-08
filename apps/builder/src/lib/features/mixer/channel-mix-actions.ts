import type { AudioEngine, CompressorSettings } from '@thinkbreak/audio-runtime';
import { CompressorSettingsSchema, parseOrThrow } from '@thinkbreak/project-schema';
import type { AudioChannelDefinition, BuilderProject } from '@thinkbreak/audio-runtime';
import { isChannelAudible } from '$lib/state/project.svelte.js';
import type { SoundSet } from '@thinkbreak/project-schema';
import { applySoundSetToProject } from '$lib/features/presets/sound-set-store.js';

type ProjectActions = {
	project: BuilderProject | null;
	snapshot(): BuilderProject | null;
	updateChannelMix(id: string, patch: Partial<AudioChannelDefinition['mix']>): void;
	updateMaster(patch: Partial<BuilderProject['master']>): void;
	replaceProject(project: BuilderProject): void;
};
type EngineSource = { engine: AudioEngine | null; syncProject(): void };
type Reporter = { push(level: 'error' | 'warning' | 'info', text: string): void };
const playable = (channel: AudioChannelDefinition) =>
	channel.role === 'pitched' || channel.role === 'percussion';
function channelOrThrow(project: BuilderProject | null, id: string): AudioChannelDefinition {
	const channel = project?.channels.find((item) => item.id === id);
	if (!channel) throw new Error(`Cannot update mix: channel "${id}" was not found.`);
	if (!playable(channel))
		throw new Error(`Cannot update mix: channel "${id}" is not a playable channel.`);
	return channel;
}

export interface ChannelGainNormalizationPlan {
	factor: number;
	changedChannelIds: readonly string[];
	project: BuilderProject;
}

/** Pure preview/plan for the confirmation UI; callers should pass a project-state snapshot. */
export function planChannelGainNormalization(
	project: BuilderProject
): ChannelGainNormalizationPlan {
	const soloedIds = project.channels.filter((channel) => channel.mix.soloed).map(({ id }) => id);
	const active = project.channels.filter(
		(channel) => playable(channel) && isChannelAudible(channel, soloedIds)
	);
	const factor = active.length === 0 ? 1 : Math.min(1, 1 / Math.sqrt(active.length));
	if (factor === 1) return { factor, changedChannelIds: [], project };

	const activeIds = new Set(active.map(({ id }) => id));
	const replacement = structuredClone(project);
	replacement.channels = replacement.channels.map((channel) =>
		activeIds.has(channel.id)
			? { ...channel, mix: { ...channel.mix, gain: channel.mix.gain * factor } }
			: channel
	);
	return { factor, changedChannelIds: [...activeIds], project: replacement };
}

export function createChannelMixActions(input: {
	projectState: ProjectActions;
	engineClient: EngineSource;
	statusState: Reporter;
}) {
	function assertMode(mode: 'live' | 'commit'): void {
		if (mode !== 'live' && mode !== 'commit')
			throw new Error('Mix update mode must be live or commit.');
	}
	function requireProject(action: string): BuilderProject {
		const project = input.projectState.project;
		if (project === null) throw new Error(`Cannot ${action}: no project is open.`);
		return project;
	}
	function mirror(action: string, update: (engine: AudioEngine) => void): boolean {
		const engine = input.engineClient.engine;
		if (!engine) return false;
		try {
			update(engine);
			return true;
		} catch (error) {
			input.statusState.push(
				'error',
				`Unable to ${action} in the audio engine: ${error instanceof Error ? error.message : String(error)}`
			);
			return false;
		}
	}
	function setChannelGain(id: string, value: number, mode: 'live' | 'commit'): boolean {
		assertMode(mode);
		if (!Number.isFinite(value) || value < 0 || value > 1)
			throw new Error('Channel gain must be from 0 to 1.');
		channelOrThrow(input.projectState.project, id);
		if (mode === 'commit') input.projectState.updateChannelMix(id, { gain: value });
		const mirrored = mirror('set channel gain', (engine) => engine.setChannelVolume(id, value));
		return mode === 'commit' ? true : mirrored;
	}
	function setChannelPan(id: string, value: number, mode: 'live' | 'commit'): boolean {
		assertMode(mode);
		if (!Number.isFinite(value) || value < -1 || value > 1)
			throw new Error('Channel pan must be from -1 to 1.');
		channelOrThrow(input.projectState.project, id);
		if (mode === 'commit') input.projectState.updateChannelMix(id, { pan: value });
		const mirrored = mirror('set channel pan', (engine) => engine.setChannelPan(id, value));
		return mode === 'commit' ? true : mirrored;
	}
	return {
		setChannelGain,
		setChannelPan,
		setChannelMuted(id: string, value: boolean): boolean {
			if (typeof value !== 'boolean') throw new Error('Channel mute must be a boolean.');
			channelOrThrow(input.projectState.project, id);
			input.projectState.updateChannelMix(id, { muted: value });
			mirror('set channel mute', (engine) => engine.setChannelMuted(id, value));
			return true;
		},
		setChannelSoloed(id: string, value: boolean): boolean {
			if (typeof value !== 'boolean') throw new Error('Channel solo must be a boolean.');
			channelOrThrow(input.projectState.project, id);
			input.projectState.updateChannelMix(id, { soloed: value });
			mirror('set channel solo', (engine) => engine.setChannelSoloed(id, value));
			return true;
		},
		setMasterGain(value: number, mode: 'live' | 'commit'): boolean {
			assertMode(mode);
			if (!Number.isFinite(value) || value < 0 || value > 1)
				throw new Error('Master gain must be from 0 to 1.');
			requireProject('set master gain');
			if (mode === 'commit') input.projectState.updateMaster({ gain: value });
			const mirrored = mirror('set master gain', (engine) => engine.setMasterVolume(value));
			return mode === 'commit' ? true : mirrored;
		},
		setMasterCompressor(settings: CompressorSettings, mode: 'live' | 'commit' = 'commit'): boolean {
			assertMode(mode);
			requireProject('set master compressor');
			const valid = parseOrThrow(
				CompressorSettingsSchema,
				settings,
				'Unable to update master compressor'
			);
			if (mode === 'commit') input.projectState.updateMaster({ compressor: valid });
			const mirrored = mirror('set master compressor', (engine) =>
				engine.setMasterCompressor(valid)
			);
			return mode === 'commit' ? true : mirrored;
		},
		normalizeChannelGains(): number {
			requireProject('normalize channel gains');
			const snapshot = input.projectState.snapshot();
			if (snapshot === null) throw new Error('Cannot normalize channel gains: no project is open.');
			const plan = planChannelGainNormalization(snapshot);
			if (plan.changedChannelIds.length === 0) return plan.factor;
			input.projectState.replaceProject(plan.project);
			input.engineClient.syncProject();
			return plan.factor;
		},
		applyConfirmedSoundSet(soundSet: SoundSet): void {
			const project = input.projectState.snapshot();
			if (project === null) throw new Error('Cannot apply sound set: no project is open.');
			const result = applySoundSetToProject({ project, soundSet });
			input.projectState.replaceProject(result.project);
			input.engineClient.syncProject();
		}
	};
}
