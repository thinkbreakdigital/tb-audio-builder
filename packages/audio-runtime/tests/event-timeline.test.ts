import { describe, expect, it } from 'vitest';
import { buildEventTimeline, findFirstEventIndexAtOrAfter } from '../src/engine/event-timeline.js';
import type { EventTimeline } from '../src/engine/event-timeline.js';
import type { CompiledNote, CompiledSong, CompiledTrack } from '../src/types/song.js';
import type {
	AudioChannelDefinition,
	ChannelMixSettings,
	ChannelRole
} from '../src/types/channel.js';
import type { PitchedInstrumentDefinition } from '../src/types/instrument.js';

function makeInstrument(): PitchedInstrumentDefinition {
	return {
		kind: 'pitched',
		presetId: null,
		oscillator: { waveform: 'sine', octaveOffset: 0, semitoneOffset: 0, fineDetuneCents: 0 },
		amplitudeEnvelope: {
			attackSeconds: 0.01,
			decaySeconds: 0.1,
			sustainLevel: 0.8,
			releaseSeconds: 0.2
		},
		filter: { enabled: false, type: 'lowpass', frequencyHz: 20000, q: 1 },
		modulation: {
			vibratoEnabled: false,
			vibratoRateHz: 5,
			vibratoDepthCents: 0,
			pitchBendRangeSemitones: 2
		},
		voice: { polyphonic: true, maxVoices: 8, stealMode: 'oldest' }
	};
}

function makeMix(): ChannelMixSettings {
	return { gain: 0.8, pan: 0, muted: false, soloed: false };
}

function makeNote(tick: number, durationTicks: number, midiNote: number): CompiledNote {
	return { tick, durationTicks, midiNote, velocity: 0.8 };
}

function makeTrack(id: string, notes: CompiledNote[]): CompiledTrack {
	return {
		id,
		sourceTrackName: id,
		midiChannel: 0,
		notes,
		pitchBends: [],
		modulationEvents: [],
		volumeEvents: []
	};
}

function makeChannel(input: {
	id: string;
	role: ChannelRole;
	sourceTrackId: string | null;
	instrument: PitchedInstrumentDefinition | null;
	enabled?: boolean;
}): AudioChannelDefinition {
	return {
		id: input.id,
		name: input.id,
		role: input.role,
		sourceTrackId: input.sourceTrackId,
		enabled: input.enabled ?? true,
		instrument: input.instrument,
		mix: makeMix()
	};
}

function makeSong(tracks: CompiledTrack[], durationTicks: number): CompiledSong {
	return {
		schemaVersion: 1,
		id: 'song-1',
		sourceFilename: 'song.mid',
		ticksPerQuarterNote: 480,
		durationTicks,
		tempoChanges: [{ tick: 0, bpm: 120 }],
		timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
		markers: [],
		tracks
	};
}

describe('buildEventTimeline', () => {
	it('only pitched/percussion channels with a resolved instrument contribute events', () => {
		const trackA = makeTrack('track-a', [makeNote(0, 480, 60)]);
		const trackB = makeTrack('track-b', [makeNote(0, 480, 62)]);
		const trackC = makeTrack('track-c', [makeNote(0, 480, 64)]);
		const song = makeSong([trackA, trackB, trackC], 1920);

		const channels: AudioChannelDefinition[] = [
			makeChannel({
				id: 'ch-pitched',
				role: 'pitched',
				sourceTrackId: 'track-a',
				instrument: makeInstrument()
			}),
			makeChannel({
				id: 'ch-ignored',
				role: 'ignored',
				sourceTrackId: 'track-b',
				instrument: null
			}),
			makeChannel({
				id: 'ch-metadata',
				role: 'metadata',
				sourceTrackId: 'track-c',
				instrument: null
			}),
			makeChannel({
				id: 'ch-no-instrument',
				role: 'pitched',
				sourceTrackId: 'track-b',
				instrument: null
			}),
			makeChannel({
				id: 'ch-no-track',
				role: 'pitched',
				sourceTrackId: null,
				instrument: makeInstrument()
			}),
			makeChannel({
				id: 'ch-unresolved-track',
				role: 'pitched',
				sourceTrackId: 'does-not-exist',
				instrument: makeInstrument()
			})
		];

		const timeline = buildEventTimeline({ song, channels });
		expect(timeline.events).toHaveLength(1);
		expect(timeline.events[0]?.channelId).toBe('ch-pitched');
	});

	it('disabled channels still contribute events', () => {
		const track = makeTrack('track-a', [makeNote(0, 480, 60)]);
		const song = makeSong([track], 1920);
		const channels: AudioChannelDefinition[] = [
			makeChannel({
				id: 'ch-disabled',
				role: 'pitched',
				sourceTrackId: 'track-a',
				instrument: makeInstrument(),
				enabled: false
			})
		];

		const timeline = buildEventTimeline({ song, channels });
		expect(timeline.events).toHaveLength(1);
		expect(timeline.events[0]?.channelId).toBe('ch-disabled');
	});

	it('sorts by tick, then channel index, then midiNote', () => {
		const trackA = makeTrack('track-a', [
			makeNote(480, 100, 70),
			makeNote(480, 100, 60),
			makeNote(0, 100, 50)
		]);
		const trackB = makeTrack('track-b', [makeNote(480, 100, 65)]);
		const song = makeSong([trackA, trackB], 1920);

		// Channel order in the `channels` array is index 0 = ch-b, index 1 = ch-a, so at a tied
		// tick, ch-b's events must sort before ch-a's despite ch-a appearing first in the tracks.
		const channels: AudioChannelDefinition[] = [
			makeChannel({
				id: 'ch-b',
				role: 'pitched',
				sourceTrackId: 'track-b',
				instrument: makeInstrument()
			}),
			makeChannel({
				id: 'ch-a',
				role: 'pitched',
				sourceTrackId: 'track-a',
				instrument: makeInstrument()
			})
		];

		const timeline = buildEventTimeline({ song, channels });
		const summary = timeline.events.map((event) => [event.tick, event.channelId, event.midiNote]);
		expect(summary).toEqual([
			[0, 'ch-a', 50],
			[480, 'ch-b', 65],
			[480, 'ch-a', 60],
			[480, 'ch-a', 70]
		]);
	});

	it('assigns a dense, ascending sequence after sorting', () => {
		const track = makeTrack('track-a', [
			makeNote(960, 100, 60),
			makeNote(0, 100, 62),
			makeNote(480, 100, 64)
		]);
		const song = makeSong([track], 1920);
		const channels: AudioChannelDefinition[] = [
			makeChannel({
				id: 'ch-a',
				role: 'pitched',
				sourceTrackId: 'track-a',
				instrument: makeInstrument()
			})
		];

		const timeline = buildEventTimeline({ song, channels });
		expect(timeline.events.map((event) => event.sequence)).toEqual([0, 1, 2]);
		// Ascending in the sorted (tick) order, not the original note order.
		expect(timeline.events.map((event) => event.tick)).toEqual([0, 480, 960]);
	});

	it('computes endTick as tick + durationTicks', () => {
		const track = makeTrack('track-a', [makeNote(100, 250, 60)]);
		const song = makeSong([track], 1000);
		const channels: AudioChannelDefinition[] = [
			makeChannel({
				id: 'ch-a',
				role: 'pitched',
				sourceTrackId: 'track-a',
				instrument: makeInstrument()
			})
		];

		const timeline = buildEventTimeline({ song, channels });
		expect(timeline.events[0]?.endTick).toBe(350);
	});
});

describe('findFirstEventIndexAtOrAfter', () => {
	function buildTimeline(): EventTimeline {
		const track = makeTrack('track-a', [
			makeNote(0, 100, 60),
			makeNote(480, 100, 62),
			makeNote(960, 100, 64)
		]);
		const song = makeSong([track], 1920);
		const channels: AudioChannelDefinition[] = [
			makeChannel({
				id: 'ch-a',
				role: 'pitched',
				sourceTrackId: 'track-a',
				instrument: makeInstrument()
			})
		];
		return buildEventTimeline({ song, channels });
	}

	it('finds the index exactly at an event tick', () => {
		const timeline = buildTimeline();
		expect(findFirstEventIndexAtOrAfter(timeline, 480)).toBe(1);
	});

	it('finds the index before the first event', () => {
		const timeline = buildTimeline();
		expect(findFirstEventIndexAtOrAfter(timeline, -100)).toBe(0);
	});

	it('finds the index between two events', () => {
		const timeline = buildTimeline();
		expect(findFirstEventIndexAtOrAfter(timeline, 500)).toBe(2);
	});

	it('returns events.length past the final event', () => {
		const timeline = buildTimeline();
		expect(findFirstEventIndexAtOrAfter(timeline, 10000)).toBe(3);
	});

	it('returns 0 on an empty timeline', () => {
		const song = makeSong([], 0);
		const timeline = buildEventTimeline({ song, channels: [] });
		expect(findFirstEventIndexAtOrAfter(timeline, 0)).toBe(0);
	});
});
