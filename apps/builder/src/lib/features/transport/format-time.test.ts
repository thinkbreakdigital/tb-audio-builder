import { describe, expect, it } from 'vitest';
import { formatSeconds, parseBarsBeats, ticksToBarsBeats } from './format-time.js';
const song = {
	schemaVersion: 1,
	id: 'x',
	sourceFilename: 'x',
	ticksPerQuarterNote: 480,
	durationTicks: 3840,
	tempoChanges: [{ tick: 0, bpm: 120 }],
	timeSignatures: [
		{ tick: 0, numerator: 4, denominator: 4 },
		{ tick: 1920, numerator: 3, denominator: 4 }
	],
	markers: [],
	tracks: []
};
describe('transport time formatting', () => {
	it('formats clock time and validates invalid values', () => {
		expect(formatSeconds(0)).toBe('0:00.000');
		expect(formatSeconds(3661.125)).toBe('61:01.125');
		expect(() => formatSeconds(-1)).toThrow(/non-negative/);
	});
	it('converts and parses bars/beats across signature changes', () => {
		expect(ticksToBarsBeats(song as never, 481)).toEqual({ bar: 1, beat: 2, tickInBeat: 1 });
		expect(ticksToBarsBeats(song as never, 1920)).toEqual({ bar: 2, beat: 1, tickInBeat: 0 });
		expect(ticksToBarsBeats(song as never, 3360)).toEqual({ bar: 3, beat: 1, tickInBeat: 0 });
		expect(parseBarsBeats(song as never, '2.1')).toBe(1920);
		expect(parseBarsBeats(song as never, '3.2')).toBe(3840);
		expect(() => parseBarsBeats(song as never, 'no')).toThrow(/bars.beats/);
	});
	it('starts a new bar at a mid-bar change and preserves an exact final boundary', () => {
		const midBar = {
			...song,
			durationTicks: 2440,
			timeSignatures: [
				{ tick: 0, numerator: 4, denominator: 4 },
				{ tick: 1000, numerator: 3, denominator: 4 }
			]
		};
		expect(ticksToBarsBeats(midBar as never, 1000)).toEqual({
			bar: 2,
			beat: 1,
			tickInBeat: 0
		});
		expect(parseBarsBeats(midBar as never, '2.1')).toBe(1000);

		const exactBar = { ...song, durationTicks: 1920, timeSignatures: [song.timeSignatures[0]!] };
		expect(ticksToBarsBeats(exactBar as never, 1920)).toMatchObject({ bar: 2, beat: 1 });
		expect(parseBarsBeats(exactBar as never, '2.1')).toBe(1920);
	});
	it('parses large songs algebraically and rejects malformed positions', () => {
		const longSong = {
			...song,
			durationTicks: 1_000_000_000,
			timeSignatures: [song.timeSignatures[0]!]
		};
		expect(parseBarsBeats(longSong as never, '500001.1')).toBe(960_000_000);
		expect(() => parseBarsBeats(song as never, '')).toThrow(/bars.beats/);
		expect(() => parseBarsBeats(song as never, '0.1')).toThrow(/positive/);
		expect(() => parseBarsBeats(song as never, '1.5')).toThrow(/outside bar/);
		expect(() => parseBarsBeats(song as never, '999.1')).toThrow(/outside this song/);
		expect(() => ticksToBarsBeats(song as never, -1)).toThrow(/integer/);
		expect(() => ticksToBarsBeats(song as never, 1.5)).toThrow(/integer/);
	});
	it('rejects malformed maps instead of returning misleading bar positions', () => {
		expect(() =>
			ticksToBarsBeats(
				{ ...song, timeSignatures: [{ tick: 0, numerator: 4, denominator: 7 }] } as never,
				0
			)
		).toThrow(/invalid time signature/);
		expect(() => ticksToBarsBeats({ ...song, durationTicks: -1 } as never, 0)).toThrow(/usable/);
		expect(() =>
			ticksToBarsBeats(
				{
					...song,
					timeSignatures: [
						{ tick: 0, numerator: 4, denominator: 4 },
						{ tick: 0, numerator: 3, denominator: 4 }
					]
				} as never,
				0
			)
		).toThrow(/malformed/);
	});
});
