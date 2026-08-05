import type { AudioChannelDefinition, BuilderProject } from '@thinkbreak/audio-runtime';
import type { SoundSet } from '../schemas';
import { pairByNameThenPosition } from './pair-by-name-then-position';

export interface SoundSetApplyPlan {
	assignments: { channelId: string; channelName: string; fromSoundSetChannel: string }[];
	unchangedChannelIds: string[];
	discardedSoundSetChannels: string[];
}

export function planSoundSetApply(input: {
	soundSet: SoundSet;
	channels: readonly AudioChannelDefinition[];
}): SoundSetApplyPlan {
	const pairing = pairByNameThenPosition(input.channels, input.soundSet.channels);
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
		plan: planSoundSetApply(input)
	};
}
