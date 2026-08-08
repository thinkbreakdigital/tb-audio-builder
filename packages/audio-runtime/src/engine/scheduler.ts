/**
 * The look-ahead loop. Owns the scheduling window, the event cursor, loop wrapping, and origin
 * rebasing on a wrap — and nothing else: it knows no instruments, channels, or buses, it hands each
 * event to `dispatch` and forgets it (spec §4.6, "the scheduler knows nothing about synthesis").
 *
 * The `setInterval` here only decides *when to look*. Every note time is derived from
 * `AudioContext.currentTime` through the origin, so no note is ever started by a timer firing.
 */

import { DEFAULT_SCHEDULER_SETTINGS, MAX_LOOP_WRAPS_PER_TICK } from '../constants.js';
import { PlaybackError } from '../errors.js';
import { findFirstEventIndexAtOrAfter } from './event-timeline.js';
import type { EventTimeline, ScheduledNoteEvent } from './event-timeline.js';
import { secondsToTick, tickToSeconds } from './tempo-map.js';
import type { TempoMap } from './tempo-map.js';

/** Mutable — the transport rebases it in place on play, seek, loop wrap, and tempo change. */
export interface PlaybackOrigin {
	originTick: number; // song tick playing at originContextSeconds
	originContextSeconds: number;
	tempoMultiplier: number;
}

/**
 * Maps a song tick onto an audio-context time through the origin. This is the formula in spec §4.8
 * and the only definition of it in the repository; the tempo multiplier is applied here rather than
 * inside the tempo map so changing it never rebuilds the map.
 */
export function contextSecondsForTick(map: TempoMap, origin: PlaybackOrigin, tick: number): number {
	return (
		origin.originContextSeconds +
		(tickToSeconds(map, tick) - tickToSeconds(map, origin.originTick)) / origin.tempoMultiplier
	);
}

/** Exact inverse of `contextSecondsForTick`. */
export function tickForContextSeconds(
	map: TempoMap,
	origin: PlaybackOrigin,
	contextSeconds: number
): number {
	const songSeconds =
		tickToSeconds(map, origin.originTick) +
		(contextSeconds - origin.originContextSeconds) * origin.tempoMultiplier;
	return secondsToTick(map, songSeconds);
}

/** Half-open `[startTick, endTick)`. Mutable — the transport owns it and edits it in place. */
export interface LoopRegion {
	enabled: boolean;
	startTick: number;
	endTick: number;
}

/**
 * Called for each event inside the window. The engine facade resolves the channel and starts a
 * voice; returning is enough, the scheduler ignores the result.
 */
export type DispatchNote = (
	event: ScheduledNoteEvent,
	startAtSeconds: number,
	releaseAtSeconds: number
) => void;

export interface Scheduler {
	readonly isRunning: boolean;
	start(): void;
	stop(): void;
	/** One look-ahead pass. The interval calls it; tests call it directly. */
	runOnce(): void;
	resetCursorToTick(tick: number): void;
	dispose(): void;
}

export function createScheduler(input: {
	context: BaseAudioContext;
	tempoMap: TempoMap;
	timeline: EventTimeline;
	origin: PlaybackOrigin; // shared mutable object, owned by the transport
	loop: LoopRegion; // shared mutable object, owned by the transport
	dispatch: DispatchNote;
	settings?: { lookaheadMs: number; intervalMs: number };
	onLoopWrap?: (origin: Readonly<PlaybackOrigin>) => void;
	onNaturalEnd?: () => void;
	onError?: (error: PlaybackError) => void;
}): Scheduler {
	const { context, tempoMap, timeline, origin, loop, dispatch } = input;
	const settings = input.settings ?? DEFAULT_SCHEDULER_SETTINGS;

	let intervalHandle: ReturnType<typeof setInterval> | null = null;
	let cursor = 0;
	let disposed = false;
	let naturalEndReported = false;

	function ensureNotDisposed(action: string): void {
		if (disposed) {
			throw new PlaybackError(`Scheduler: cannot ${action} after dispose().`);
		}
	}

	/**
	 * Dispatches every event from the cursor with `tick < limitTick` — half-open, so an event
	 * landing exactly on the limit belongs to the next pass. `clampReleaseToTick` is the loop end
	 * whenever a loop is active: notes crossing it are cut at the boundary rather than carried into
	 * the next pass, whichever window happens to dispatch them. Its context time is resolved once,
	 * against the origin in force for this pass.
	 */
	function dispatchUpTo(limitTick: number, clampReleaseToTick: number | null): void {
		const clampReleaseAtSeconds =
			clampReleaseToTick === null ? 0 : contextSecondsForTick(tempoMap, origin, clampReleaseToTick);
		const events = timeline.events;

		while (cursor < events.length) {
			const event = events[cursor] as ScheduledNoteEvent;
			if (event.tick >= limitTick) return;
			cursor += 1;

			// The whole note is scheduled here, release included, and never re-examined in a later
			// window — that is what keeps a note crossing a window boundary from being split.
			const startAtSeconds = contextSecondsForTick(tempoMap, origin, event.tick);
			let releaseAtSeconds = contextSecondsForTick(tempoMap, origin, event.endTick);
			if (clampReleaseToTick !== null && event.endTick > clampReleaseToTick) {
				releaseAtSeconds = clampReleaseAtSeconds;
			}
			dispatch(event, startAtSeconds, releaseAtSeconds);
		}
	}

	/** A region that does not advance is not a loop; treat it as no loop instead of wrapping forever. */
	function loopIsActive(): boolean {
		return loop.enabled && loop.endTick > loop.startTick;
	}

	function wrapLoop(): void {
		// Clamped to now so that enabling a loop region behind the playhead jumps into the region
		// immediately instead of rebasing into the past and wrapping until the cap trips.
		const loopEndContextSeconds = Math.max(
			contextSecondsForTick(tempoMap, origin, loop.endTick),
			context.currentTime
		);
		origin.originTick = loop.startTick;
		origin.originContextSeconds = loopEndContextSeconds;
		cursor = findFirstEventIndexAtOrAfter(timeline, loop.startTick);
		input.onLoopWrap?.({ ...origin });
	}

	function runOnce(): void {
		ensureNotDisposed('runOnce()');

		const windowEndSeconds = context.currentTime + settings.lookaheadMs / 1000;
		let windowEndTick = tickForContextSeconds(tempoMap, origin, windowEndSeconds);
		let wraps = 0;

		while (loopIsActive() && windowEndTick > loop.endTick) {
			if (wraps >= MAX_LOOP_WRAPS_PER_TICK) {
				const loopLengthTicks = loop.endTick - loop.startTick;
				const loopLengthSeconds =
					tickToSeconds(tempoMap, loop.endTick) - tickToSeconds(tempoMap, loop.startTick);
				throw new PlaybackError(
					`Scheduler: loop region [${loop.startTick}, ${loop.endTick}) is ${loopLengthTicks} ` +
						`ticks (${loopLengthSeconds}s) and wrapped more than ${MAX_LOOP_WRAPS_PER_TICK} ` +
						`times inside one ${settings.lookaheadMs}ms look-ahead window.`
				);
			}
			dispatchUpTo(loop.endTick, loop.endTick);
			wrapLoop();
			wraps += 1;
			// Same window, new origin — the remaining look-ahead is filled from the loop start.
			windowEndTick = tickForContextSeconds(tempoMap, origin, windowEndSeconds);
		}

		dispatchUpTo(windowEndTick, loopIsActive() ? loop.endTick : null);

		if (
			!loopIsActive() &&
			!naturalEndReported &&
			cursor >= timeline.events.length &&
			tickForContextSeconds(tempoMap, origin, context.currentTime) >= tempoMap.durationTicks
		) {
			naturalEndReported = true;
			if (intervalHandle !== null) {
				clearInterval(intervalHandle);
				intervalHandle = null;
			}
			input.onNaturalEnd?.();
		}
	}

	function runIntervalTick(): void {
		try {
			runOnce();
		} catch (cause) {
			const error =
				cause instanceof PlaybackError
					? cause
					: new PlaybackError('Scheduler interval failed while filling the look-ahead window.', {
							cause
						});
			if (intervalHandle !== null) {
				clearInterval(intervalHandle);
				intervalHandle = null;
			}
			if (input.onError === undefined) throw error;
			input.onError(error);
		}
	}

	return {
		get isRunning(): boolean {
			return intervalHandle !== null;
		},

		start(): void {
			ensureNotDisposed('start()');
			// Exactly one interval: starting an already-running scheduler is a no-op.
			if (intervalHandle !== null) return;
			intervalHandle = setInterval(runIntervalTick, settings.intervalMs);
			// Fill the first window now rather than waiting a full interval for it.
			runIntervalTick();
		},

		stop(): void {
			if (intervalHandle === null) return;
			clearInterval(intervalHandle);
			intervalHandle = null;
		},

		runOnce,

		resetCursorToTick(tick: number): void {
			ensureNotDisposed('resetCursorToTick()');
			cursor = findFirstEventIndexAtOrAfter(timeline, tick);
			naturalEndReported = false;
		},

		dispose(): void {
			if (intervalHandle !== null) {
				clearInterval(intervalHandle);
				intervalHandle = null;
			}
			disposed = true;
		}
	};
}
