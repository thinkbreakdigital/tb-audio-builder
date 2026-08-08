import { Midi } from '@tonejs/midi';
import { describe, expect, it } from 'vitest';
import { MidiWarningCollector, normalizeMidi } from '../src/normalize-midi';
import { buildMidiFixture } from './fixtures/build-fixture';

function normalizeFixture(input: {
	fileBytes: ArrayBuffer;
	inspectionComplete: boolean;
}): ReturnType<typeof normalizeMidi> {
	const midi = new Midi(input.fileBytes);
	return normalizeMidi({
		midi,
		sourceFilename: 'normalize.mid',
		songId: 'song-id',
		scannedEventsByTrack: midi.tracks.map(() => []),
		inspectionComplete: input.inspectionComplete,
		warnings: new MidiWarningCollector()
	});
}

describe('normalizeMidi inspection handling', () => {
	it('recognizes parsed controller data even when no scanner events were attributed', () => {
		const result = normalizeFixture({
			fileBytes: buildMidiFixture({
				tracks: [
					{
						name: 'Filter automation',
						controlChanges: [{ controller: 74, tick: 120, value: 0.5 }]
					}
				]
			}),
			inspectionComplete: true
		});

		expect(result.song.tracks.map((track) => track.sourceTrackName)).toEqual(['Filter automation']);
	});

	it('omits truly empty tracks only after a complete inspection', () => {
		const fileBytes = buildMidiFixture({
			tracks: [
				{ name: 'Lead', notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }] },
				{ name: 'Empty' }
			]
		});

		const complete = normalizeFixture({ fileBytes, inspectionComplete: true });
		const incomplete = normalizeFixture({ fileBytes, inspectionComplete: false });

		expect(complete.song.tracks.map((track) => track.sourceTrackName)).toEqual(['Lead']);
		expect(incomplete.song.tracks.map((track) => track.sourceTrackName)).toEqual(['Lead', 'Empty']);
	});
});
