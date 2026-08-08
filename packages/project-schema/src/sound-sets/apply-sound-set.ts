import type { AudioChannelDefinition, BuilderProject } from '@thinkbreak/audio-runtime';
import type { SoundSet } from '../schemas/index.js';
import { pairByNameThenPosition } from './pair-by-name-then-position.js';

export interface SoundSetApplyPlan {
	assignments: { channelId: string; channelName: string; fromSoundSetChannel: string }[];
	unchangedChannelIds: string[];
	discardedSoundSetChannels: string[];
}

type SoundSetPairing = {
	pairs: { left: AudioChannelDefinition; right: SoundSet['channels'][number] }[];
	unmatchedLeft: AudioChannelDefinition[];
	unmatchedRight: SoundSet['channels'][number][];
};

function createSoundSetApplyPlan(pairing: SoundSetPairing): SoundSetApplyPlan {
	return {
		assignments: pairing.pairs.map(({ left, right }) => ({
			channelId: left.id,
			channelName: left.name,
			fromSoundSetChannel: right.name
		})),
		unchangedChannelIds: pairing.unmatchedLeft.map(({ id }) => id),
		discardedSoundSetChannels: pairing.unmatchedRight.map(({ name }) => name)
	};
}

export function planSoundSetApply(input: {
	soundSet: SoundSet;
	channels: readonly AudioChannelDefinition[];
}): SoundSetApplyPlan {
	const pairing = pairByNameThenPosition(input.channels, input.soundSet.channels);
	return createSoundSetApplyPlan(pairing);
}

export function applySoundSet(input: {
	soundSet: SoundSet;
	channels: readonly AudioChannelDefinition[];
}): {
	channels: AudioChannelDefinition[];
	master: BuilderProject['master'];
	plan: SoundSetApplyPlan;
} {
	const pairing = pairByNameThenPosition(input.channels, input.soundSet.channels);
	const replacements = new Map(
		pairing.pairs.map(({ left, right }) => [
			left.id,
			{
				...left,
				name: right.name,
				role: right.role,
				enabled: right.enabled,
				instrument: structuredClone(right.instrument),
				mix: { ...right.mix }
			}
		])
	);

	return {
		channels: input.channels.map((channel) => replacements.get(channel.id) ?? channel),
		master: structuredClone(input.soundSet.master),
		plan: createSoundSetApplyPlan(pairing)
	};
}
