/**
 * Playback state and position. Owns the `PlaybackOrigin` and the loop region, and drives the
 * scheduler that reads both.
 *
 * The origin is rebased on exactly four events — play, seek, loop wrap (inside the scheduler), and
 * a tempo-multiplier change. Nothing else touches it, which is what keeps `positionTicks` a pure
 * read of `context.currentTime`.
 */

import {
	DEFAULT_SCHEDULER_SETTINGS,
	DEFAULT_TEMPO_MULTIPLIER,
	MAX_TEMPO_MULTIPLIER,
	MIN_TEMPO_MULTIPLIER
} from '../constants.js';
import { PlaybackError } from '../errors.js';
import { clamp } from '../synth/conversions.js';
import { createScheduler, tickForContextSeconds } from './scheduler.js';
import type { DispatchNote, LoopRegion, PlaybackOrigin } from './scheduler.js';
import type { EventTimeline } from './event-timeline.js';
import { tickToSeconds, secondsToTick } from './tempo-map.js';
import type { TempoMap } from './tempo-map.js';
import type { VoiceManager } from './voice-manager.js';

export type TransportStatus = 'stopped' | 'playing' | 'paused';

export interface Transport {
	readonly status: TransportStatus;
	readonly positionTicks: number; // computed from context time on read
	readonly positionSeconds: number;
	readonly durationTicks: number;
	readonly durationSeconds: number;
	play(): void;
	pause(): void;
	stop(): void;
	seekToTick(tick: number): void;
	seekToSeconds(seconds: number): void;
	setLoop(input: { enabled: boolean; startTick: number; endTick: number }): void;
	setTempoMultiplier(multiplier: number): void;
	dispose(): void;
}

export function createTransport(input: {
	context: BaseAudioContext;
	tempoMap: TempoMap;
	timeline: EventTimeline;
	voiceManager: VoiceManager;
	dispatch: DispatchNote;
	settings?: { lookaheadMs: number; intervalMs: number };
}): Transport {
	const { context, tempoMap, timeline, voiceManager, dispatch } = input;
	const settings = input.settings ?? DEFAULT_SCHEDULER_SETTINGS;
	const durationTicks = tempoMap.durationTicks;

	let status: TransportStatus = 'stopped';
	// The position while not playing. While playing, position comes from the context clock instead.
	let storedTick = 0;
	let disposed = false;

	const origin: PlaybackOrigin = {
		originTick: 0,
		originContextSeconds: context.currentTime,
		tempoMultiplier: DEFAULT_TEMPO_MULTIPLIER
	};
	// Defaults to the whole song so enabling a loop before a region is chosen is meaningful.
	const loop: LoopRegion = { enabled: false, startTick: 0, endTick: durationTicks };

	const scheduler = createScheduler({
		context,
		tempoMap,
		timeline,
		origin,
		loop,
		dispatch,
		settings
	});

	function ensureNotDisposed(action: string): void {
		if (disposed) {
			throw new PlaybackError(`Transport: cannot ${action} after dispose().`);
		}
	}

	function readPositionTicks(): number {
		return status === 'playing'
			? tickForContextSeconds(tempoMap, origin, context.currentTime)
			: storedTick;
	}

	/** The tick now playing becomes the new origin, anchored at the current context time. */
	function rebaseOriginTo(tick: number): void {
		origin.originTick = tick;
		origin.originContextSeconds = context.currentTime;
	}

	function seekToTick(tick: number): void {
		ensureNotDisposed('seekToTick()');
		const target = clamp(tick, 0, durationTicks);
		storedTick = target;
		voiceManager.stopAll(context.currentTime);
		rebaseOriginTo(target);
		scheduler.resetCursorToTick(target);
	}

	return {
		get status(): TransportStatus {
			return status;
		},
		get positionTicks(): number {
			return readPositionTicks();
		},
		get positionSeconds(): number {
			return tickToSeconds(tempoMap, readPositionTicks());
		},
		get durationTicks(): number {
			return durationTicks;
		},
		get durationSeconds(): number {
			return tempoMap.durationSeconds;
		},

		play(): void {
			ensureNotDisposed('play()');
			if (status === 'playing') return;
			// Always resumes from the stored tick: stop() stores 0, so "play from stopped starts at
			// tick 0" and "seek then play starts at the seeked tick" are the same rule.
			rebaseOriginTo(storedTick);
			scheduler.resetCursorToTick(storedTick);
			status = 'playing';
			scheduler.start();
		},

		pause(): void {
			ensureNotDisposed('pause()');
			if (status !== 'playing') return;
			storedTick = readPositionTicks();
			scheduler.stop();
			status = 'paused';
			voiceManager.releaseAll(context.currentTime);
		},

		stop(): void {
			ensureNotDisposed('stop()');
			storedTick = 0;
			scheduler.stop();
			scheduler.resetCursorToTick(0);
			status = 'stopped';
			// A hard stop, not a release: no tail survives a stop.
			voiceManager.stopAll(context.currentTime);
		},

		seekToTick,

		seekToSeconds(seconds: number): void {
			ensureNotDisposed('seekToSeconds()');
			seekToTick(secondsToTick(tempoMap, seconds));
		},

		setLoop(loopInput: { enabled: boolean; startTick: number; endTick: number }): void {
			ensureNotDisposed('setLoop()');
			const { enabled, startTick, endTick } = loopInput;
			if (!(startTick >= 0 && startTick < endTick && endTick <= durationTicks)) {
				throw new PlaybackError(
					`Transport.setLoop: region [${startTick}, ${endTick}) is invalid; it must satisfy ` +
						`0 <= startTick < endTick <= durationTicks (${durationTicks}).`
				);
			}
			// Mutated in place: the scheduler holds this same object and reads it each window.
			loop.enabled = enabled;
			loop.startTick = startTick;
			loop.endTick = endTick;
		},

		setTempoMultiplier(multiplier: number): void {
			ensureNotDisposed('setTempoMultiplier()');
			// Rebase first, against the OLD multiplier — otherwise the audible position jumps.
			rebaseOriginTo(readPositionTicks());
			origin.tempoMultiplier = clamp(multiplier, MIN_TEMPO_MULTIPLIER, MAX_TEMPO_MULTIPLIER);
		},

		dispose(): void {
			if (disposed) return;
			disposed = true;
			scheduler.dispose();
			status = 'stopped';
			voiceManager.stopAll(context.currentTime);
		}
	};
}
