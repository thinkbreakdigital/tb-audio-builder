import { describe, expect, it } from 'vitest';
import { validateLoopRegion, wholeSongLoop } from './loop-region.js';
describe('loop regions', () => {
	it('accepts valid ranges and rejects malformed or degenerate ranges', () => {
		const region = { startTick: 0, endTick: 480 };
		const result = validateLoopRegion(region, 480);
		expect(result).toEqual({
			startTick: 0,
			endTick: 480
		});
		expect(result).not.toBe(region);
		expect(wholeSongLoop(480)).toEqual({ startTick: 0, endTick: 480 });
		expect(() => validateLoopRegion({ startTick: 10, endTick: 10 }, 480)).toThrow(/after/);
		expect(() => validateLoopRegion({ startTick: 11, endTick: 10 }, 480)).toThrow(/after/);
		expect(() => validateLoopRegion({ startTick: -1, endTick: 1 }, 480)).toThrow(/between/);
		expect(() => validateLoopRegion({ startTick: 0, endTick: 481 }, 480)).toThrow(/between/);
		expect(() => validateLoopRegion({ startTick: 0.5, endTick: 1 }, 480)).toThrow(/whole/);
		expect(() =>
			validateLoopRegion({ startTick: 0, endTick: 1 }, Number.POSITIVE_INFINITY)
		).toThrow(/positive duration/);
		expect(() => validateLoopRegion({ startTick: 0, endTick: 1 }, 1.5)).toThrow(
			/positive duration/
		);
		expect(() => validateLoopRegion(null as never, 480)).toThrow(/object/);
	});
});
