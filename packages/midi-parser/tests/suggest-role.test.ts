import type { ChannelRole } from '@thinkbreak/audio-runtime';
import { describe, expect, it } from 'vitest';
import { compileMidiFile, suggestRoleForTrackName } from '../src/index';
import { buildMidiFixture } from './fixtures/build-fixture';

describe('suggestRoleForTrackName', () => {
	it('maps all nine kickoff example track names to the documented role', () => {
		const cases: { name: string; role: ChannelRole }[] = [
			{ name: 'PULSE_1', role: 'pitched' },
			{ name: 'PULSE_2', role: 'pitched' },
			{ name: 'TRI_BASS', role: 'pitched' },
			{ name: 'SIGNAL_LEAD', role: 'pitched' },
			{ name: 'DRONE', role: 'pitched' },
			{ name: 'NOISE_KICK', role: 'percussion' },
			{ name: 'NOISE_SNARE', role: 'percussion' },
			{ name: 'NOISE_HAT', role: 'percussion' },
			{ name: 'BOTGEN_META', role: 'metadata' }
		];

		for (const { name, role } of cases) {
			const suggestion = suggestRoleForTrackName(name);
			expect(suggestion.role).toBe(role);
			expect(suggestion.confidence).toBe('high');
		}
	});

	it('is case- and separator-insensitive when matching the percussion pattern', () => {
		for (const name of ['noise-kick', 'NoiseKick', 'NOISE KICK']) {
			const suggestion = suggestRoleForTrackName(name);
			expect(suggestion.role).toBe('percussion');
			expect(suggestion.confidence).toBe('high');
		}
	});

	it('suggests percussion for channel 9 even when the track is named PIANO', () => {
		// The channel-9 override lives in compile-midi.ts, not in suggestRoleForTrackName itself
		// (§4.6 rule 2: "this check lives in compile-midi.ts ... it overrides rule 3 and below"),
		// so this exercises it through compileMidiFile rather than the name-matcher in isolation.
		const fileBytes = buildMidiFixture({
			tracks: [
				{
					name: 'PIANO',
					channel: 9,
					notes: [{ tick: 0, durationTicks: 10, midiNote: 36, velocity: 1 }]
				}
			]
		});

		const result = compileMidiFile({ fileBytes, filename: 'channel9.mid' });
		const suggestion = result.suggestions.find((s) => s.sourceTrackName === 'PIANO');

		expect(suggestion?.role).toBe('percussion');
		expect(suggestion?.confidence).toBe('high');
	});

	it('falls back to pitched with low confidence for an unmatched name', () => {
		const suggestion = suggestRoleForTrackName('Xylotron9000');

		expect(suggestion.role).toBe('pitched');
		expect(suggestion.confidence).toBe('low');
	});

	it('suggests metadata for a note-free track that carries its own marker event', () => {
		// §4.6's rule is track-scoped: the parser scans each track's own raw bytes for a
		// marker/cuePoint meta event, so the marker has to live inside the specific track's MTrk
		// chunk (buildMidiFixture's per-track `markers` option), not the song-level one. The track
		// is named something that would not otherwise match any name pattern, so a 'metadata' result
		// can only come from the marker rule and not from name matching.
		const fileBytes = buildMidiFixture({
			tracks: [
				{ name: 'Lead', notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }] },
				{
					name: 'Xylotron9000',
					controlChanges: [{ controller: 1, tick: 0, value: 0 }],
					markers: [{ tick: 0, name: 'Verse' }]
				}
			]
		});

		const result = compileMidiFile({ fileBytes, filename: 'marker-track.mid' });
		const suggestion = result.suggestions.find((s) => s.sourceTrackName === 'Xylotron9000');

		expect(suggestion?.role).toBe('metadata');
		expect(suggestion?.confidence).toBe('high');
	});

	it('does not suggest metadata for a note-free track when only the song, not the track, has a marker', () => {
		// The contrasting case for the rule above: a song-level marker (in the conductor track)
		// must not leak onto an unrelated note-free automation track that carries no marker of its
		// own, or every CC-only track in a marked-up song would be mislabelled metadata.
		const fileBytes = buildMidiFixture({
			tracks: [
				{ name: 'Lead', notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }] },
				{ name: 'Xylotron9000', controlChanges: [{ controller: 1, tick: 0, value: 0 }] }
			],
			markers: [{ tick: 0, name: 'Verse' }]
		});

		const result = compileMidiFile({ fileBytes, filename: 'song-level-marker-only.mid' });
		const suggestion = result.suggestions.find((s) => s.sourceTrackName === 'Xylotron9000');

		expect(suggestion?.role).not.toBe('metadata');
	});
});
