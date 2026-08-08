/**
 * Flattens a song plus its channels into one sorted array, built once per project change, so the
 * scheduler never scans tracks at playback time.
 */

import type { CompiledSong, CompiledTrack } from '../types/song.js';
import type { AudioChannelDefinition } from '../types/channel.js';
import { findFirstIndexAtOrAfter, type NumericKeyOf } from '../util/binary-search.js';

export interface ScheduledNoteEvent {
	tick: number;
	endTick: number; // tick + durationTicks
	channelId: string;
	midiNote: number;
	velocity: number; // 0..1
	sequence: number; // index in the timeline; ties are broken by this, making order deterministic
}

export interface EventTimeline {
	readonly events: readonly ScheduledNoteEvent[];
	readonly durationTicks: number;
}

const eventTickOf: NumericKeyOf<ScheduledNoteEvent> = (event) => event.tick;

/** Pre-sequence shape; `sequence` is only meaningful once the final sort order is known. */
interface UnsequencedEvent {
	tick: number;
	endTick: number;
	channelId: string;
	midiNote: number;
	velocity: number;
	channelIndex: number;
}

export function buildEventTimeline(input: {
	song: CompiledSong;
	channels: readonly AudioChannelDefinition[];
}): EventTimeline {
	const { song, channels } = input;
	const tracksById = new Map<string, CompiledTrack>(song.tracks.map((track) => [track.id, track]));

	const unsequenced: UnsequencedEvent[] = [];
	for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
		const channel = channels[channelIndex] as AudioChannelDefinition;
		// enablement, mute, solo, and gain are dispatch-time decisions — they never gate timeline
		// membership, so toggling them during playback needs no rebuild.
		if (channel.role !== 'pitched' && channel.role !== 'percussion') continue;
		if (channel.instrument === null) continue;
		if (channel.sourceTrackId === null) continue;
		const track = tracksById.get(channel.sourceTrackId);
		if (track === undefined) continue;

		for (const note of track.notes) {
			unsequenced.push({
				tick: note.tick,
				endTick: note.tick + note.durationTicks,
				channelId: channel.id,
				midiNote: note.midiNote,
				velocity: note.velocity,
				channelIndex
			});
		}
	}

	// Sort order is the contract that makes voice stealing deterministic (kickoff §16).
	unsequenced.sort((a, b) => {
		if (a.tick !== b.tick) return a.tick - b.tick;
		if (a.channelIndex !== b.channelIndex) return a.channelIndex - b.channelIndex;
		return a.midiNote - b.midiNote;
	});

	const events: ScheduledNoteEvent[] = unsequenced.map((event, sequence) => ({
		tick: event.tick,
		endTick: event.endTick,
		channelId: event.channelId,
		midiNote: event.midiNote,
		velocity: event.velocity,
		sequence
	}));

	return { events, durationTicks: song.durationTicks };
}

export function findFirstEventIndexAtOrAfter(timeline: EventTimeline, tick: number): number {
	return findFirstIndexAtOrAfter(timeline.events, tick, eventTickOf);
}
