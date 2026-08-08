import type { AudioChannelDefinition } from '@thinkbreak/audio-runtime';
export type Audibility = 'not-included' | 'muted' | 'silenced-by-solo' | 'audible';
export function resolveAudibility(
	channel: AudioChannelDefinition,
	soloedChannelIds: readonly string[]
): Audibility {
	if (!channel.enabled) return 'not-included';
	if (channel.mix.muted) return 'muted';
	if (soloedChannelIds.length > 0 && !channel.mix.soloed) return 'silenced-by-solo';
	return 'audible';
}
