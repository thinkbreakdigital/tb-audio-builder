import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEventTimeline } from '../src/engine/event-timeline.js';
import { createTempoMap } from '../src/engine/tempo-map.js';
import { createScheduler } from '../src/engine/scheduler.js';
import type { LoopRegion, PlaybackOrigin, Scheduler } from '../src/engine/scheduler.js';
import { PlaybackError } from '../src/errors.js';
import { asBaseAudioContext, createFakeAudioContext } from './fakes/fake-audio-context.js';
import type { FakeAudioContext } from './fakes/fake-audio-context.js';
import { buildSong, notesEvery } from './fakes/build-song.js';
import type { BuildSongInput } from './fakes/build-song.js';

/**
 * At 480 PPQ and 120 BPM a quarter note is 0.5s, so 960 ticks is one second — every expected time
 * in this file is derived from that.
 */
const BAR_TICKS = 1920;

interface DispatchedNote {
	tick: number;
	endTick: number;
	channelId: string;
	startAtSeconds: number;
	releaseAtSeconds: number;
}

interface SchedulerHarness {
	fake: FakeAudioContext;
	origin: PlaybackOrigin;
	loop: LoopRegion;
	dispatched: DispatchedNote[];
	scheduler: Scheduler;
}

function setupScheduler(input: {
	song: BuildSongInput;
	loop?: Partial<LoopRegion>;
	settings?: { lookaheadMs: number; intervalMs: number };
}): SchedulerHarness {
	const fake = createFakeAudioContext();
	const { song, channels } = buildSong(input.song);
	const tempoMap = createTempoMap({
		tempoChanges: song.tempoChanges,
		ticksPerQuarterNote: song.ticksPerQuarterNote,
		durationTicks: song.durationTicks
	});
	const timeline = buildEventTimeline({ song, channels });

	const origin: PlaybackOrigin = { originTick: 0, originContextSeconds: 0, tempoMultiplier: 1 };
	const loop: LoopRegion = {
		enabled: false,
		startTick: 0,
		endTick: song.durationTicks,
		...input.loop
	};
	const dispatched: DispatchedNote[] = [];

	const scheduler = createScheduler({
		context: asBaseAudioContext(fake),
		tempoMap,
		timeline,
		origin,
		loop,
		dispatch: (event, startAtSeconds, releaseAtSeconds) => {
			dispatched.push({
				tick: event.tick,
				endTick: event.endTick,
				channelId: event.channelId,
				startAtSeconds,
				releaseAtSeconds
			});
		},
		settings: input.settings
	});

	return { fake, origin, loop, dispatched, scheduler };
}

/**
 * The context clock and the interval timer are two independent clocks; this walks them forward
 * together in interval-sized steps so each look-ahead pass sees the context time it really would.
 */
function runFor(fake: FakeAudioContext, seconds: number, stepMs = 25): void {
	const steps = Math.round((seconds * 1000) / stepMs);
	for (let step = 0; step < steps; step += 1) {
		fake.advanceTimeBy(stepMs / 1000);
		vi.advanceTimersByTime(stepMs);
	}
}

/** Same walk, but driving `runOnce()` directly instead of the interval. */
function stepManually(harness: SchedulerHarness, seconds: number, stepMs = 25): void {
	const steps = Math.round((seconds * 1000) / stepMs);
	for (let step = 0; step < steps; step += 1) {
		harness.fake.advanceTimeBy(stepMs / 1000);
		harness.scheduler.runOnce();
	}
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('createScheduler', () => {
	it('schedules exactly the events inside the look-ahead window and no more', () => {
		const harness = setupScheduler({
			song: { channels: [{ notes: notesEvery({ count: 4, stepTicks: 480 }) }] }
		});

		harness.scheduler.runOnce();

		// The 100ms window at tick 0 reaches tick 96; only the note at tick 0 is inside it.
		expect(harness.dispatched.map((note) => note.tick)).toEqual([0]);
		expect(harness.dispatched[0]?.startAtSeconds).toBeCloseTo(0, 9);
		expect(harness.dispatched[0]?.releaseAtSeconds).toBeCloseTo(0.5, 9);
	});

	it('schedules every event of the song exactly once as time advances', () => {
		const harness = setupScheduler({
			song: { channels: [{ notes: notesEvery({ count: 8, stepTicks: 480 }) }] }
		});

		stepManually(harness, 4.2);

		expect(harness.dispatched).toHaveLength(8);
		expect(harness.dispatched.map((note) => note.tick)).toEqual([
			0, 480, 960, 1440, 1920, 2400, 2880, 3360
		]);
		harness.dispatched.forEach((note, index) => {
			expect(note.startAtSeconds).toBeCloseTo(index * 0.5, 9);
		});
	});

	it('schedules a note ending far outside the window once, with its full release time', () => {
		const harness = setupScheduler({
			song: { channels: [{ notes: [{ tick: 0, durationTicks: 19200 }] }] }
		});

		stepManually(harness, 1);

		expect(harness.dispatched).toHaveLength(1);
		expect(harness.dispatched[0]?.releaseAtSeconds).toBeCloseTo(20, 9);
	});

	it('loops a 4-bar region for 3 passes with no event duplicated or dropped', () => {
		const regionTicks = 4 * BAR_TICKS; // 7680 ticks = 8 seconds at 120 BPM
		const regionNoteTicks = [0, 960, 1920, 2880, 3840, 4800, 5760, 6720];
		const harness = setupScheduler({
			song: {
				durationTicks: regionTicks,
				channels: [{ notes: notesEvery({ count: 8, stepTicks: 960 }) }]
			},
			loop: { enabled: true, startTick: 0, endTick: regionTicks }
		});

		harness.scheduler.start();
		// Three 8-second passes minus a look-ahead margin, so pass 4's first note stays outside.
		runFor(harness.fake, 23.8);

		expect(harness.dispatched.map((note) => note.tick)).toEqual([
			...regionNoteTicks,
			...regionNoteTicks,
			...regionNoteTicks
		]);
		harness.dispatched.forEach((note, index) => {
			expect(note.startAtSeconds).toBeCloseTo(index, 6);
		});
	});

	it('never plays an event landing exactly on loopEndTick in the pass that ends there', () => {
		const regionTicks = 4 * BAR_TICKS;
		const harness = setupScheduler({
			song: {
				durationTicks: regionTicks + 960,
				channels: [{ notes: notesEvery({ count: 9, stepTicks: 960 }) }]
			},
			loop: { enabled: true, startTick: 0, endTick: regionTicks }
		});

		harness.scheduler.start();
		runFor(harness.fake, 15.8); // two full passes

		expect(harness.dispatched.some((note) => note.tick === regionTicks)).toBe(false);
		expect(harness.dispatched).toHaveLength(16);
	});

	it('releases a note whose end crosses loopEndTick at the loop boundary', () => {
		const regionTicks = 4 * BAR_TICKS;
		const harness = setupScheduler({
			song: {
				durationTicks: regionTicks + 960,
				channels: [{ notes: [{ tick: 0 }, { tick: 7200, durationTicks: 960 }] }]
			},
			loop: { enabled: true, startTick: 0, endTick: regionTicks }
		});

		harness.scheduler.start();
		runFor(harness.fake, 7.6);

		const crossing = harness.dispatched.find((note) => note.tick === 7200);
		expect(crossing?.endTick).toBe(8160); // past the loop end
		expect(crossing?.releaseAtSeconds).toBeCloseTo(8, 6); // cut at the loop boundary
	});

	it('schedules a loop shorter than the look-ahead window across several wraps in one pass', () => {
		// 24 ticks is 25ms at 120 BPM — the 100ms window spans four passes of it.
		const harness = setupScheduler({
			song: { durationTicks: 24, channels: [{ notes: [{ tick: 0, durationTicks: 24 }] }] },
			loop: { enabled: true, startTick: 0, endTick: 24 }
		});

		harness.scheduler.runOnce();

		expect(harness.dispatched).toHaveLength(4);
		harness.dispatched.forEach((note, index) => {
			expect(note.startAtSeconds).toBeCloseTo(index * 0.025, 9);
		});
	});

	it('throws a PlaybackError naming the loop length once a pathological loop exceeds 64 wraps', () => {
		const harness = setupScheduler({
			song: { durationTicks: 1, channels: [{ notes: [{ tick: 0, durationTicks: 1 }] }] },
			loop: { enabled: true, startTick: 0, endTick: 1 }
		});

		// One call only: the pass mutates the origin as it wraps, so a second call starts elsewhere.
		let caught: unknown;
		try {
			harness.scheduler.runOnce();
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(PlaybackError);
		expect((caught as Error).message).toContain('loop region [0, 1) is 1 ticks');
		expect((caught as Error).message).toContain('more than 64 times');
		expect(harness.dispatched).toHaveLength(64);
	});

	it('starting an already-running scheduler creates one interval and duplicates no events', () => {
		const harness = setupScheduler({
			song: { channels: [{ notes: notesEvery({ count: 8, stepTicks: 480 }) }] }
		});

		harness.scheduler.start();
		harness.scheduler.start();

		expect(vi.getTimerCount()).toBe(1);
		expect(harness.scheduler.isRunning).toBe(true);

		runFor(harness.fake, 4.2);

		const ticks = harness.dispatched.map((note) => note.tick);
		expect(ticks).toEqual([0, 480, 960, 1440, 1920, 2400, 2880, 3360]);
		expect(new Set(ticks).size).toBe(ticks.length);
	});

	it('lands notes after a mid-song tempo change at the correct context times', () => {
		const harness = setupScheduler({
			song: {
				tempoChanges: [
					{ tick: 0, bpm: 120 },
					{ tick: 1920, bpm: 240 }
				],
				channels: [{ notes: notesEvery({ count: 7, stepTicks: 480 }) }]
			}
		});

		stepManually(harness, 3);

		expect(harness.dispatched.map((note) => note.tick)).toEqual([
			0, 480, 960, 1440, 1920, 2400, 2880
		]);
		const expectedStarts = [0, 0.5, 1, 1.5, 2, 2.25, 2.5];
		harness.dispatched.forEach((note, index) => {
			expect(note.startAtSeconds).toBeCloseTo(expectedStarts[index] as number, 9);
		});
	});

	it('refuses to run after dispose and leaves no interval behind', () => {
		const harness = setupScheduler({
			song: { channels: [{ notes: notesEvery({ count: 4, stepTicks: 480 }) }] }
		});

		harness.scheduler.start();
		harness.scheduler.dispose();

		expect(vi.getTimerCount()).toBe(0);
		expect(harness.scheduler.isRunning).toBe(false);
		expect(() => harness.scheduler.runOnce()).toThrow(PlaybackError);
		// Disposing twice is safe.
		expect(() => harness.scheduler.dispose()).not.toThrow();
	});
});
