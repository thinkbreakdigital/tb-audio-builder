import type {
	AudioChannelDefinition,
	ChannelRole,
	CompiledSong,
	CompiledTrack
} from '@thinkbreak/audio-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileChannels } from './channel-assignment.js';

function makeTrack(id: string, sourceTrackName: string): CompiledTrack {
	return {
		id: `00000000-0000-4000-8000-${id.padStart(12, '0')}`,
		sourceTrackName,
		midiChannel: 0,
		notes: [{ tick: 0, durationTicks: 120, midiNote: 60, velocity: 0.8 }],
		pitchBends: [],
		modulationEvents: [],
		volumeEvents: []
	};
}

function makeSong(names: readonly string[]): CompiledSong {
	return {
		schemaVersion: 1,
		id: crypto.randomUUID(),
		sourceFilename: 'fixture.mid',
		ticksPerQuarterNote: 480,
		durationTicks: 480,
		tempoChanges: [{ tick: 0, bpm: 120 }],
		timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
		markers: [],
		tracks: names.map((name, index) => makeTrack(String(index + 1), name))
	};
}

function makeChannel(
	id: string,
	name: string,
	role: ChannelRole = 'pitched',
	overrides: Partial<AudioChannelDefinition> = {}
): AudioChannelDefinition {
	return {
		id,
		name,
		role,
		sourceTrackId: 'old-track',
		enabled: true,
		instrument: null,
		mix: { gain: 0.8, pan: 0, muted: false, soloed: false },
		...overrides
	};
}

function suggestions(song: CompiledSong, roles: readonly ChannelRole[]) {
	return song.tracks.map((track, index) => ({
		trackId: track.id,
		trackIndex: index,
		sourceTrackName: track.sourceTrackName,
		role: roles[index] ?? 'pitched',
		reason: 'fixture',
		confidence: 'high' as const
	}));
}

beforeEach(() => {
	vi.restoreAllMocks();
});

describe('reconcileChannels', () => {
	it('creates four channels with suggested roles on the first import', () => {
		const song = makeSong(['Drums', 'Bass', 'Keys', 'Notes']);
		const result = reconcileChannels({
			song,
			existingChannels: [],
			suggestions: suggestions(song, ['percussion', 'pitched', 'pitched', 'metadata'])
		});

		expect(result.channels).toHaveLength(4);
		expect(result.channels.map((channel) => channel.role)).toEqual([
			'percussion',
			'pitched',
			'pitched',
			'metadata'
		]);
		expect(result.preservedChannelCount).toBe(0);
	});

	it('preserves ids, instruments, mixes, and updates source track ids on re-import', () => {
		const oldSong = makeSong(['Drums', 'Bass', 'Keys', 'Lead']);
		const existing = oldSong.tracks.map((track, index) =>
			makeChannel(`channel-${index}`, track.sourceTrackName, 'pitched', {
				instrument:
					index === 0 ? ({ kind: 'pitched' } as AudioChannelDefinition['instrument']) : null,
				mix: { gain: index / 10, pan: -0.2, muted: index === 1, soloed: index === 2 }
			})
		);
		const newSong = makeSong(['Drums', 'Bass', 'Keys', 'Lead']);
		newSong.tracks.forEach((track, index) => {
			track.id = `00000000-0000-4000-8000-${String(index + 101).padStart(12, '0')}`;
		});

		const result = reconcileChannels({
			song: newSong,
			existingChannels: existing,
			suggestions: suggestions(newSong, ['pitched', 'pitched', 'pitched', 'pitched'])
		});

		expect(result.preservedChannelCount).toBe(4);
		expect(result.channels.map((channel) => channel.id)).toEqual(
			existing.map((channel) => channel.id)
		);
		expect(result.channels.map((channel) => channel.instrument)).toEqual(
			existing.map((channel) => channel.instrument)
		);
		expect(result.channels.map((channel) => channel.mix)).toEqual(
			existing.map((channel) => channel.mix)
		);
		expect(result.channels.map((channel) => channel.sourceTrackId)).toEqual(
			newSong.tracks.map((track) => track.id)
		);
	});

	it('keeps a user-set role when a new suggestion disagrees', () => {
		const song = makeSong(['Bass']);
		const result = reconcileChannels({
			song,
			existingChannels: [makeChannel('channel', 'Bass', 'ignored')],
			suggestions: suggestions(song, ['pitched'])
		});

		expect(result.channels[0]?.role).toBe('ignored');
	});

	it('uses positional matching when a track is renamed', () => {
		const song = makeSong(['Renamed']);
		const result = reconcileChannels({
			song,
			existingChannels: [makeChannel('channel', 'Original')],
			suggestions: suggestions(song, ['pitched'])
		});

		expect(result.channels[0]?.id).toBe('channel');
		expect(result.preservedChannelCount).toBe(1);
	});

	it('drops a channel for a removed track', () => {
		const song = makeSong(['Bass']);
		const result = reconcileChannels({
			song,
			existingChannels: [makeChannel('bass', 'Bass'), makeChannel('removed', 'Removed')],
			suggestions: suggestions(song, ['pitched'])
		});

		expect(result.droppedChannelCount).toBe(1);
		expect(result.channels.map((channel) => channel.id)).toEqual(['bass']);
	});

	it('creates an added track with no instrument', () => {
		const song = makeSong(['Bass', 'Lead']);
		const result = reconcileChannels({
			song,
			existingChannels: [makeChannel('bass', 'Bass')],
			suggestions: suggestions(song, ['pitched', 'pitched'])
		});

		expect(result.newChannelCount).toBe(1);
		expect(result.channels[1]?.instrument).toBeNull();
	});

	it('uses Track N for an empty track name', () => {
		const song = makeSong(['']);
		const result = reconcileChannels({ song, existingChannels: [], suggestions: [] });

		expect(result.channels[0]?.name).toBe('Track 1');
	});

	it('consumes duplicate existing names at most once', () => {
		const song = makeSong(['Bass']);
		const result = reconcileChannels({
			song,
			existingChannels: [makeChannel('first', 'Bass'), makeChannel('second', 'Bass')],
			suggestions: suggestions(song, ['pitched'])
		});

		expect(result.preservedChannelCount).toBe(1);
		expect(result.droppedChannelCount).toBe(1);
		expect(result.channels[0]?.id).toBe('first');
	});

	it('returns channels in song track order even when name matches are ordered differently', () => {
		const song = makeSong(['First', 'Second']);
		const result = reconcileChannels({
			song,
			existingChannels: [
				makeChannel('second-channel', 'Second'),
				makeChannel('first-channel', 'First')
			],
			suggestions: suggestions(song, ['pitched', 'pitched'])
		});

		expect(result.channels.map((channel) => channel.id)).toEqual([
			'first-channel',
			'second-channel'
		]);
	});
});
