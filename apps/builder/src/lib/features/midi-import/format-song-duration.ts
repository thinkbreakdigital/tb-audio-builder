import type { CompiledSong } from '@thinkbreak/audio-runtime';

/**
 * This duplicates the tick->second conversion that 00-conventions.md §4.10 requires to live only
 * in `@thinkbreak/audio-runtime`. It exists here only because phase 06 has not built
 * `engine/tempo-map.ts` yet. Phase 06 MUST delete this file and switch `ImportSummary` to
 * `tickToSeconds` once that module exists. Keep this file to that one job — no other timing
 * helpers belong here.
 */

function ticksToSeconds(song: CompiledSong, targetTick: number): number {
	const changes = song.tempoChanges;
	let seconds = 0;
	for (let index = 0; index < changes.length; index += 1) {
		const change = changes[index];
		if (change === undefined) continue;
		if (change.tick >= targetTick) break;
		const nextChange = changes[index + 1];
		const segmentEndTick =
			nextChange !== undefined ? Math.min(nextChange.tick, targetTick) : targetTick;
		const secondsPerTick = 60 / (change.bpm * song.ticksPerQuarterNote);
		seconds += (segmentEndTick - change.tick) * secondsPerTick;
	}
	return seconds;
}

/** Formats `song.durationTicks` as `m:ss.mmm`. */
export function formatSongDuration(song: CompiledSong): string {
	const totalMs = Math.round(ticksToSeconds(song, song.durationTicks) * 1000);
	const milliseconds = totalMs % 1000;
	const totalSeconds = Math.floor(totalMs / 1000);
	const seconds = totalSeconds % 60;
	const minutes = Math.floor(totalSeconds / 60);
	return `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}
