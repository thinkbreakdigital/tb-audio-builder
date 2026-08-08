import { describe, expect, it } from 'vitest';
import {
	bpmAtTick,
	createTempoMap,
	secondsToTick,
	tickToSeconds
} from '../src/engine/tempo-map.js';
import type { TempoChange } from '../src/types/song.js';

describe('createTempoMap', () => {
	it('constant 120 BPM at 480 PPQ gives 0.5s per quarter note', () => {
		const map = createTempoMap({
			tempoChanges: [{ tick: 0, bpm: 120 }],
			ticksPerQuarterNote: 480,
			durationTicks: 1920
		});
		expect(tickToSeconds(map, 480)).toBeCloseTo(0.5, 10);
		expect(tickToSeconds(map, 960)).toBeCloseTo(1, 10);
	});

	it('a tempo change at tick 1920 shifts later ticks by exactly the expected amount', () => {
		const map = createTempoMap({
			tempoChanges: [
				{ tick: 0, bpm: 120 },
				{ tick: 1920, bpm: 60 }
			],
			ticksPerQuarterNote: 480,
			durationTicks: 3840
		});
		// First 1920 ticks (4 quarter notes) at 120 BPM = 2 seconds.
		const secondsAtChange = tickToSeconds(map, 1920);
		expect(secondsAtChange).toBeCloseTo(2, 10);
		// After the change, 480 ticks (1 quarter note) at 60 BPM = 1 second.
		expect(tickToSeconds(map, 2400)).toBeCloseTo(3, 10);
	});

	it('three-segment maps accumulate startSeconds correctly', () => {
		const map = createTempoMap({
			tempoChanges: [
				{ tick: 0, bpm: 120 },
				{ tick: 960, bpm: 90 },
				{ tick: 1920, bpm: 150 }
			],
			ticksPerQuarterNote: 480,
			durationTicks: 3840
		});
		expect(map.segments).toHaveLength(3);
		const [first, second, third] = map.segments as [
			(typeof map.segments)[0],
			(typeof map.segments)[0],
			(typeof map.segments)[0]
		];
		expect(first.startSeconds).toBeCloseTo(0, 10);
		expect(second.startSeconds).toBeCloseTo(
			first.startSeconds + (second.startTick - first.startTick) * first.secondsPerTick,
			10
		);
		expect(third.startSeconds).toBeCloseTo(
			second.startSeconds + (third.startTick - second.startTick) * second.secondsPerTick,
			10
		);
	});

	it('secondsToTick is the exact inverse of tickToSeconds across a sweep of 1000 ticks', () => {
		const map = createTempoMap({
			tempoChanges: [
				{ tick: 0, bpm: 120 },
				{ tick: 960, bpm: 90 },
				{ tick: 1920, bpm: 150 }
			],
			ticksPerQuarterNote: 480,
			durationTicks: 3840
		});
		for (let i = 0; i < 1000; i++) {
			const tick = (i / 999) * 3840;
			const seconds = tickToSeconds(map, tick);
			expect(Math.abs(secondsToTick(map, seconds) - tick)).toBeLessThan(1e-6);
		}
	});

	it('inserts a 120 BPM entry when tick 0 is missing', () => {
		const map = createTempoMap({
			tempoChanges: [{ tick: 480, bpm: 90 }],
			ticksPerQuarterNote: 480,
			durationTicks: 960
		});
		expect(map.segments[0]?.startTick).toBe(0);
		expect(map.segments[0]?.bpm).toBe(120);
		expect(bpmAtTick(map, 0)).toBe(120);
	});

	it('sorts and de-duplicates tempo changes, last entry per tick winning', () => {
		const tempoChanges: TempoChange[] = [
			{ tick: 480, bpm: 100 },
			{ tick: 0, bpm: 120 },
			{ tick: 480, bpm: 140 }
		];
		const map = createTempoMap({ tempoChanges, ticksPerQuarterNote: 480, durationTicks: 960 });
		expect(map.segments).toHaveLength(2);
		expect(bpmAtTick(map, 480)).toBe(140);
	});

	it('throws with the offending value when bpm <= 0', () => {
		expect(() =>
			createTempoMap({
				tempoChanges: [{ tick: 0, bpm: 0 }],
				ticksPerQuarterNote: 480,
				durationTicks: 960
			})
		).toThrow(/0/);
	});

	it('throws with the offending value when ticksPerQuarterNote < 1', () => {
		expect(() =>
			createTempoMap({ tempoChanges: [], ticksPerQuarterNote: 0, durationTicks: 960 })
		).toThrow(/0/);
	});

	it('extrapolates linearly past the end of the last segment', () => {
		const map = createTempoMap({
			tempoChanges: [{ tick: 0, bpm: 120 }],
			ticksPerQuarterNote: 480,
			durationTicks: 960
		});
		const secondsPastEnd = tickToSeconds(map, 1920);
		const lastSegment = map.segments[map.segments.length - 1];
		expect(lastSegment).toBeDefined();
		expect(secondsPastEnd).toBeCloseTo(
			(lastSegment as NonNullable<typeof lastSegment>).startSeconds +
				(1920 - (lastSegment as NonNullable<typeof lastSegment>).startTick) *
					(lastSegment as NonNullable<typeof lastSegment>).secondsPerTick,
			10
		);
	});

	it('extrapolates linearly before tick 0 without throwing or clamping', () => {
		const map = createTempoMap({
			tempoChanges: [{ tick: 0, bpm: 120 }],
			ticksPerQuarterNote: 480,
			durationTicks: 960
		});
		expect(tickToSeconds(map, -480)).toBeCloseTo(-0.5, 10);
	});
});
