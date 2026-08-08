export interface LoopRegion {
	startTick: number;
	endTick: number;
}
export function validateLoopRegion(region: LoopRegion, durationTicks: number): LoopRegion {
	if (!Number.isInteger(durationTicks) || durationTicks <= 0)
		throw new Error('A loop requires a song with a positive duration.');
	if (region === null || typeof region !== 'object')
		throw new Error('Loop region must be an object.');
	if (!Number.isInteger(region.startTick) || !Number.isInteger(region.endTick))
		throw new Error('Loop start and end must be whole ticks.');
	if (region.startTick < 0 || region.endTick > durationTicks)
		throw new Error(`Loop must stay between 0 and ${durationTicks} ticks.`);
	if (region.endTick <= region.startTick) throw new Error('Loop end must be after loop start.');
	return { ...region };
}
export function wholeSongLoop(durationTicks: number): LoopRegion {
	return validateLoopRegion({ startTick: 0, endTick: durationTicks }, durationTicks);
}
