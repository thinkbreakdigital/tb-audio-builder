import { describe, expect, it } from 'vitest';
import { isChannelAudible } from '$lib/state/project.svelte.js';
import { resolveAudibility } from './mixer-audibility.js';
const channel = (enabled: boolean, muted: boolean, soloed: boolean) =>
	({
		id: 'a',
		name: 'A',
		role: 'pitched',
		sourceTrackId: null,
		enabled,
		instrument: { kind: 'pitched' },
		mix: { gain: 0.8, pan: 0, muted, soloed }
	}) as never;
describe('mixer audibility', () => {
	it('is exhaustive and agrees with the shared boolean', () => {
		for (const enabled of [false, true]) {
			for (const muted of [false, true]) {
				for (const soloed of [false, true]) {
					for (const soloedIds of [[], ['a'], ['other']]) {
						const candidate = channel(enabled, muted, soloed);
						expect(resolveAudibility(candidate, soloedIds) === 'audible').toBe(
							isChannelAudible(candidate, soloedIds)
						);
					}
				}
			}
		}
		expect(resolveAudibility(channel(false, false, false), [])).toBe('not-included');
		expect(resolveAudibility(channel(true, true, true), ['a'])).toBe('muted');
		expect(resolveAudibility(channel(true, false, false), ['other'])).toBe('silenced-by-solo');
	});
});
