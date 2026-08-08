import type { CompiledSong } from '@thinkbreak/audio-runtime';

export function formatSeconds(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0)
		throw new Error(`Time must be a non-negative finite number; received ${seconds}.`);
	const wholeMilliseconds = Math.floor(seconds * 1000);
	const minutes = Math.floor(wholeMilliseconds / 60_000);
	const remainingMilliseconds = wholeMilliseconds % 60_000;
	return `${minutes}:${String(Math.floor(remainingMilliseconds / 1000)).padStart(2, '0')}.${String(remainingMilliseconds % 1000).padStart(3, '0')}`;
}

export interface BarsBeats {
	bar: number;
	beat: number;
	tickInBeat: number;
}

function ticksPerBeat(song: CompiledSong, denominator: number): number {
	return (song.ticksPerQuarterNote * 4) / denominator;
}
function assertSong(song: CompiledSong): void {
	if (
		!Number.isInteger(song.ticksPerQuarterNote) ||
		song.ticksPerQuarterNote <= 0 ||
		!Number.isInteger(song.durationTicks) ||
		song.durationTicks < 0 ||
		song.timeSignatures.length === 0
	)
		throw new Error('Song has no usable time-signature map.');
}

function signatures(song: CompiledSong) {
	assertSong(song);
	let previousTick = -1;
	return song.timeSignatures.map((signature, index) => {
		if (
			!Number.isInteger(signature.tick) ||
			signature.tick < 0 ||
			signature.tick > song.durationTicks ||
			signature.tick <= previousTick ||
			(index === 0 && signature.tick !== 0)
		)
			throw new Error('Song has a malformed time-signature map.');
		previousTick = signature.tick;
		const beatTicks = ticksPerBeat(song, signature.denominator);
		if (
			!Number.isInteger(signature.numerator) ||
			signature.numerator <= 0 ||
			!Number.isInteger(signature.denominator) ||
			signature.denominator <= 0 ||
			!Number.isInteger(beatTicks) ||
			beatTicks <= 0
		)
			throw new Error('Song has an invalid time signature.');
		return { ...signature, beatTicks, barTicks: beatTicks * signature.numerator };
	});
}

export function ticksToBarsBeats(song: CompiledSong, tick: number): BarsBeats {
	const map = signatures(song);
	if (!Number.isInteger(tick) || tick < 0 || tick > song.durationTicks)
		throw new Error(`Tick must be an integer from 0 to ${song.durationTicks}; received ${tick}.`);
	let bar = 1;
	for (let index = 0; index < map.length; index += 1) {
		const signature = map[index]!;
		const nextTick = map[index + 1]?.tick ?? song.durationTicks;
		if (tick >= signature.tick && (tick < nextTick || index === map.length - 1)) {
			const local = tick - signature.tick;
			return {
				bar: bar + Math.floor(local / signature.barTicks),
				beat: Math.floor((local % signature.barTicks) / signature.beatTicks) + 1,
				tickInBeat: local % signature.beatTicks
			};
		}
		bar += Math.ceil((nextTick - signature.tick) / signature.barTicks);
	}
	throw new Error(`Tick ${tick} is outside the time-signature map.`);
}

export function parseBarsBeats(song: CompiledSong, text: string): number {
	const map = signatures(song);
	const match = /^(\d+)\.(\d+)$/.exec(text.trim());
	if (match === null) throw new Error('Enter bars.beats, for example 3.1.');
	const bar = Number(match[1]);
	const beat = Number(match[2]);
	if (!Number.isSafeInteger(bar) || !Number.isSafeInteger(beat) || bar < 1 || beat < 1)
		throw new Error('Bar and beat must be positive integers.');
	let firstBar = 1;
	for (let index = 0; index < map.length; index += 1) {
		const signature = map[index]!;
		const nextTick = map[index + 1]?.tick ?? song.durationTicks;
		const span = nextTick - signature.tick;
		// A final endpoint on an exact bar boundary is a useful loop-end position (for example,
		// 2.1 at the end of one complete bar). Intermediate endpoints belong to the next signature.
		const bars =
			index === map.length - 1
				? Math.floor(span / signature.barTicks) + 1
				: Math.ceil(span / signature.barTicks);
		if (bar >= firstBar && bar < firstBar + bars) {
			if (beat > signature.numerator) throw new Error(`Beat ${beat} is outside bar ${bar}.`);
			const tick =
				signature.tick + (bar - firstBar) * signature.barTicks + (beat - 1) * signature.beatTicks;
			if (tick < nextTick || (index === map.length - 1 && tick <= song.durationTicks)) return tick;
		}
		firstBar += bars;
	}
	throw new Error(`Bar ${bar}, beat ${beat} is outside this song.`);
}
