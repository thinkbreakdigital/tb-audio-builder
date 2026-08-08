/**
 * The only place ticks become seconds. Pure — no Web Audio, no allocation on the hot
 * `tickToSeconds` / `secondsToTick` paths (`keyOf` callbacks are hoisted to module scope so binary
 * search never allocates a closure per call).
 *
 * The tempo multiplier is NOT part of this map; the transport applies it separately when mapping
 * song seconds onto audio-context seconds, so changing it never rebuilds the map.
 */

import type { TempoChange } from '../types/song.js';
import { DEFAULT_TEMPO_BPM } from '../constants.js';
import { findLastIndexAtOrBefore, type NumericKeyOf } from '../util/binary-search.js';

export interface TempoMapSegment {
	startTick: number;
	startSeconds: number;
	bpm: number;
	secondsPerTick: number; // 60 / (bpm * ticksPerQuarterNote)
}

export interface TempoMap {
	readonly ticksPerQuarterNote: number;
	readonly segments: readonly TempoMapSegment[];
	readonly durationTicks: number;
	readonly durationSeconds: number;
}

const segmentStartTickOf: NumericKeyOf<TempoMapSegment> = (segment) => segment.startTick;
const segmentStartSecondsOf: NumericKeyOf<TempoMapSegment> = (segment) => segment.startSeconds;

export function createTempoMap(input: {
	tempoChanges: readonly TempoChange[];
	ticksPerQuarterNote: number;
	durationTicks: number;
}): TempoMap {
	const { tempoChanges, ticksPerQuarterNote, durationTicks } = input;

	if (ticksPerQuarterNote < 1) {
		throw new Error(
			`createTempoMap: ticksPerQuarterNote must be >= 1, received ${ticksPerQuarterNote}.`
		);
	}
	for (const change of tempoChanges) {
		if (change.bpm <= 0) {
			throw new Error(
				`createTempoMap: tempo change at tick ${change.tick} has non-positive bpm ${change.bpm}.`
			);
		}
	}

	// Stable sort preserves input order among ties, so "last entry per tick wins" falls out of
	// simply keeping the last item seen for each tick after sorting.
	const sorted = [...tempoChanges].sort((a, b) => a.tick - b.tick);
	const deduped: TempoChange[] = [];
	for (const change of sorted) {
		const last = deduped[deduped.length - 1];
		if (last !== undefined && last.tick === change.tick) {
			deduped[deduped.length - 1] = change;
		} else {
			deduped.push(change);
		}
	}
	if (deduped.length === 0 || (deduped[0] as TempoChange).tick !== 0) {
		deduped.unshift({ tick: 0, bpm: DEFAULT_TEMPO_BPM });
	}

	const segments: TempoMapSegment[] = [];
	let previousStartTick = 0;
	let previousStartSeconds = 0;
	let previousSecondsPerTick = 0;
	for (let i = 0; i < deduped.length; i++) {
		const change = deduped[i] as TempoChange;
		const secondsPerTick = 60 / (change.bpm * ticksPerQuarterNote);
		const startSeconds =
			i === 0
				? 0
				: previousStartSeconds + (change.tick - previousStartTick) * previousSecondsPerTick;
		segments.push({ startTick: change.tick, startSeconds, bpm: change.bpm, secondsPerTick });
		previousStartTick = change.tick;
		previousStartSeconds = startSeconds;
		previousSecondsPerTick = secondsPerTick;
	}

	const map: TempoMap = { ticksPerQuarterNote, segments, durationTicks, durationSeconds: 0 };
	return { ...map, durationSeconds: tickToSeconds(map, durationTicks) };
}

/** Segment lookup shared by `tickToSeconds` and `bpmAtTick`; extrapolates before/after the map. */
function segmentAtOrBeforeTick(map: TempoMap, tick: number): TempoMapSegment {
	const segments = map.segments;
	const index = findLastIndexAtOrBefore(segments, tick, segmentStartTickOf);
	return index === -1 ? (segments[0] as TempoMapSegment) : (segments[index] as TempoMapSegment);
}

export function tickToSeconds(map: TempoMap, tick: number): number {
	const segment = segmentAtOrBeforeTick(map, tick);
	return segment.startSeconds + (tick - segment.startTick) * segment.secondsPerTick;
}

export function secondsToTick(map: TempoMap, seconds: number): number {
	const segments = map.segments;
	const index = findLastIndexAtOrBefore(segments, seconds, segmentStartSecondsOf);
	const segment =
		index === -1 ? (segments[0] as TempoMapSegment) : (segments[index] as TempoMapSegment);
	return segment.startTick + (seconds - segment.startSeconds) / segment.secondsPerTick;
}

export function bpmAtTick(map: TempoMap, tick: number): number {
	return segmentAtOrBeforeTick(map, tick).bpm;
}
