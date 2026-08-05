import { CompiledSongSchema } from '@thinkbreak/project-schema';
import { describe, expect, it } from 'vitest';
import { MAX_MIDI_FILE_BYTES, MidiImportError, compileMidiFile } from '../src/index';
import { buildMidiFixture } from './fixtures/build-fixture';

function expectMidiImportError(
	fileBytes: ArrayBuffer,
	filename: string,
	causePattern: RegExp
): void {
	let caught: unknown;
	try {
		compileMidiFile({ fileBytes, filename });
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(MidiImportError);
	const error = caught as MidiImportError;
	expect(error.filename).toBe(filename);
	expect(error.message).toContain(filename);
	expect(error.message).toMatch(causePattern);
}

describe('compileMidiFile', () => {
	it('produces one CompiledTrack per source track with source names preserved', () => {
		const fileBytes = buildMidiFixture({
			tracks: [
				{ name: 'Lead', notes: [{ tick: 0, durationTicks: 480, midiNote: 60, velocity: 1 }] },
				{ name: 'Bass', notes: [{ tick: 0, durationTicks: 480, midiNote: 40, velocity: 1 }] }
			]
		});

		const result = compileMidiFile({ fileBytes, filename: 'two-track.mid' });

		expect(result.song.tracks).toHaveLength(2);
		expect(result.song.tracks.map((track) => track.sourceTrackName)).toEqual(['Lead', 'Bass']);
	});

	it('round-trips note ticks, durations, and midi notes exactly, and keeps velocity in 0..1', () => {
		const fileBytes = buildMidiFixture({
			tracks: [
				{
					name: 'Notes',
					notes: [
						{ tick: 0, durationTicks: 240, midiNote: 60, velocity: 1 },
						{ tick: 240, durationTicks: 120, midiNote: 67, velocity: 100 / 127 },
						{ tick: 960, durationTicks: 60, midiNote: 21, velocity: 1 / 127 }
					]
				}
			]
		});

		const result = compileMidiFile({ fileBytes, filename: 'notes.mid' });
		const notes = result.song.tracks[0]?.notes ?? [];

		expect(notes).toHaveLength(3);
		expect(notes[0]).toMatchObject({ tick: 0, durationTicks: 240, midiNote: 60 });
		expect(notes[1]).toMatchObject({ tick: 240, durationTicks: 120, midiNote: 67 });
		expect(notes[2]).toMatchObject({ tick: 960, durationTicks: 60, midiNote: 21 });
		// A MIDI byte only carries 7 bits of velocity resolution, so the round trip through the
		// fixture's encoded bytes cannot reproduce the input float bit-for-bit; it can only land
		// within one quantization step (1/127) of it.
		expect(notes[0]?.velocity).toBeCloseTo(1, 1);
		expect(notes[1]?.velocity).toBeCloseTo(100 / 127, 1);
		expect(notes[2]?.velocity).toBeCloseTo(1 / 127, 1);
		for (const note of notes) {
			expect(note.velocity).toBeGreaterThanOrEqual(0);
			expect(note.velocity).toBeLessThanOrEqual(1);
		}
	});

	it('carries the fixture ppq through as ticksPerQuarterNote', () => {
		const fileBytes = buildMidiFixture({
			ppq: 960,
			tracks: [{ notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }] }]
		});

		const result = compileMidiFile({ fileBytes, filename: 'ppq.mid' });

		expect(result.song.ticksPerQuarterNote).toBe(960);
	});

	it('sorts tempo changes by tick and preserves their BPM values', () => {
		const fileBytes = buildMidiFixture({
			tempos: [
				{ tick: 480, bpm: 140 },
				{ tick: 0, bpm: 100 },
				{ tick: 1920, bpm: 200 }
			],
			tracks: [{ notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }] }]
		});

		const result = compileMidiFile({ fileBytes, filename: 'tempo.mid' });

		expect(result.song.tempoChanges.map((change) => change.tick)).toEqual([0, 480, 1920]);
		// MIDI stores tempo as an integer number of microseconds per quarter note, not as BPM
		// directly, so 140 BPM round-trips as 428571us -> 140.00014000014 BPM. The parser is
		// correct to preserve that rather than silently rounding it back to 140, so BPM is compared
		// with tolerance instead of exact equality.
		expect(result.song.tempoChanges[0]?.bpm).toBeCloseTo(100, 3);
		expect(result.song.tempoChanges[1]?.bpm).toBeCloseTo(140, 3);
		expect(result.song.tempoChanges[2]?.bpm).toBeCloseTo(200, 3);
	});

	it('defaults to 120 BPM at tick 0 and warns when no tempo event is present', () => {
		const fileBytes = buildMidiFixture({
			tracks: [{ notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }] }]
		});

		const result = compileMidiFile({ fileBytes, filename: 'no-tempo.mid' });

		expect(result.song.tempoChanges[0]).toEqual({ tick: 0, bpm: 120 });
		const warning = result.warnings.find((w) => w.eventType === 'tempo');
		expect(warning).toBeDefined();
		expect(warning?.tick).toBe(0);
	});

	it('defaults to 4/4 at tick 0 and warns when no time signature is present', () => {
		const fileBytes = buildMidiFixture({
			tracks: [{ notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }] }]
		});

		const result = compileMidiFile({ fileBytes, filename: 'no-time-signature.mid' });

		expect(result.song.timeSignatures[0]).toEqual({ tick: 0, numerator: 4, denominator: 4 });
		const warning = result.warnings.find((w) => /time signature/i.test(w.message));
		expect(warning).toBeDefined();
		expect(warning?.tick).toBe(0);
	});

	it('sets durationTicks to the last note tick plus its durationTicks', () => {
		const fileBytes = buildMidiFixture({
			tracks: [
				{
					notes: [
						{ tick: 0, durationTicks: 480, midiNote: 60, velocity: 1 },
						{ tick: 960, durationTicks: 240, midiNote: 62, velocity: 1 }
					]
				}
			]
		});

		const result = compileMidiFile({ fileBytes, filename: 'duration.mid' });

		expect(result.song.durationTicks).toBe(1200);
	});

	it('extracts markers sorted by tick and drops empty-named markers with a warning', () => {
		const fileBytes = buildMidiFixture({
			tracks: [{ notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }] }],
			markers: [
				{ tick: 1920, name: 'Chorus' },
				{ tick: 0, name: 'Intro' },
				{ tick: 480, name: '' }
			]
		});

		const result = compileMidiFile({ fileBytes, filename: 'markers.mid' });

		expect(result.song.markers).toEqual([
			{ tick: 0, name: 'Intro' },
			{ tick: 1920, name: 'Chorus' }
		]);
		const warning = result.warnings.find((w) => w.tick === 480 && /marker/i.test(w.message));
		expect(warning).toBeDefined();
	});

	it('normalizes pitch bends to -1..1 and sorts them by tick', () => {
		const fileBytes = buildMidiFixture({
			tracks: [
				{
					notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }],
					pitchBends: [
						{ tick: 200, value: 0.5 },
						{ tick: 0, value: -1 },
						{ tick: 100, value: -0.5 }
					]
				}
			]
		});

		const result = compileMidiFile({ fileBytes, filename: 'pitchbend.mid' });
		const pitchBends = result.song.tracks[0]?.pitchBends ?? [];

		expect(pitchBends).toHaveLength(3);
		expect(pitchBends.map((pb) => pb.tick)).toEqual([0, 100, 200]);
		expect(pitchBends[0]?.value).toBeCloseTo(-1, 3);
		expect(pitchBends[1]?.value).toBeCloseTo(-0.5, 3);
		expect(pitchBends[2]?.value).toBeCloseTo(0.5, 3);
		for (const pitchBend of pitchBends) {
			expect(pitchBend.value).toBeGreaterThanOrEqual(-1);
			expect(pitchBend.value).toBeLessThanOrEqual(1);
		}
	});

	it('maps CC1 to modulationEvents and CC7 to volumeEvents, both normalized to 0..1', () => {
		const fileBytes = buildMidiFixture({
			tracks: [
				{
					notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }],
					controlChanges: [
						{ controller: 1, tick: 0, value: 0.25 },
						{ controller: 7, tick: 10, value: 0.75 }
					]
				}
			]
		});

		const result = compileMidiFile({ fileBytes, filename: 'cc.mid' });
		const track = result.song.tracks[0];

		expect(track?.modulationEvents).toHaveLength(1);
		expect(track?.modulationEvents[0]?.tick).toBe(0);
		expect(track?.modulationEvents[0]?.value).toBeCloseTo(0.25, 1);
		expect(track?.volumeEvents).toHaveLength(1);
		expect(track?.volumeEvents[0]?.tick).toBe(10);
		expect(track?.volumeEvents[0]?.value).toBeCloseTo(0.75, 1);
	});

	it('throws MidiImportError naming the filename and cause for empty, oversized, non-MIDI, and note-free input', () => {
		expectMidiImportError(new ArrayBuffer(0), 'empty.mid', /is empty/i);

		const oversized = new ArrayBuffer(MAX_MIDI_FILE_BYTES + 1024);
		expectMidiImportError(oversized, 'oversized.mid', new RegExp(String(MAX_MIDI_FILE_BYTES)));

		const nonMidi = new TextEncoder().encode('this is not a midi file, just text').buffer;
		expectMidiImportError(nonMidi as ArrayBuffer, 'not-midi.mid', /is not a standard midi file/i);

		const noNotes = buildMidiFixture({
			tracks: [{ controlChanges: [{ controller: 74, tick: 0, value: 0.5 }] }]
		});
		expectMidiImportError(noNotes, 'no-notes.mid', /no note events/i);
	});

	it('returns a song that passes CompiledSongSchema', () => {
		const fileBytes = buildMidiFixture({
			tracks: [
				{ name: 'Lead', notes: [{ tick: 0, durationTicks: 480, midiNote: 60, velocity: 1 }] },
				{
					name: 'Perc',
					channel: 9,
					notes: [{ tick: 0, durationTicks: 120, midiNote: 36, velocity: 1 }]
				}
			],
			markers: [{ tick: 0, name: 'Top' }]
		});

		const result = compileMidiFile({ fileBytes, filename: 'schema.mid' });
		const parsed = CompiledSongSchema.safeParse(result.song);

		expect(parsed.success).toBe(true);
	});

	it('assigns a fresh song id and track ids on every call for the same bytes', () => {
		const fileBytes = buildMidiFixture({
			tracks: [{ name: 'Lead', notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }] }]
		});

		const first = compileMidiFile({ fileBytes, filename: 'same.mid' });
		const second = compileMidiFile({ fileBytes, filename: 'same.mid' });

		expect(first.song.id).not.toBe(second.song.id);
		expect(first.song.tracks[0]?.id).toBeTruthy();
		expect(second.song.tracks[0]?.id).toBeTruthy();
		expect(first.song.tracks[0]?.id).not.toBe(second.song.tracks[0]?.id);
	});
});
