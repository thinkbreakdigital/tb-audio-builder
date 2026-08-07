import type { AudioChannelDefinition, ChannelRole, CompiledSong } from '@thinkbreak/audio-runtime';
import { createChannelForTrack, pairByNameThenPosition } from '@thinkbreak/project-schema';
import type { TrackRoleSuggestion } from '@thinkbreak/midi-parser';

export function reconcileChannels(input: {
	song: CompiledSong;
	existingChannels: readonly AudioChannelDefinition[];
	suggestions: readonly TrackRoleSuggestion[];
}): {
	channels: AudioChannelDefinition[];
	preservedChannelCount: number;
	newChannelCount: number;
	droppedChannelCount: number;
} {
	const tracks = input.song.tracks.map((track, trackIndex) => ({
		name: track.sourceTrackName.trim() || `Track ${trackIndex + 1}`,
		track
	}));
	const pairing = pairByNameThenPosition(input.existingChannels, tracks);
	const suggestionsByTrackId = new Map(
		input.suggestions.map((suggestion) => [suggestion.trackId, suggestion.role])
	);
	const channelsByTrackId = new Map<string, AudioChannelDefinition>();

	for (const pair of pairing.pairs) {
		channelsByTrackId.set(pair.right.track.id, {
			id: pair.left.id,
			name: pair.left.name,
			role: pair.left.role,
			sourceTrackId: pair.right.track.id,
			enabled: pair.left.enabled,
			instrument: pair.left.instrument,
			mix: pair.left.mix
		});
	}

	for (const unmatched of pairing.unmatchedRight) {
		const role: ChannelRole = suggestionsByTrackId.get(unmatched.track.id) ?? 'pitched';
		channelsByTrackId.set(
			unmatched.track.id,
			createChannelForTrack({
				track: { ...unmatched.track, sourceTrackName: unmatched.name },
				role,
				instrument: null
			})
		);
	}

	return {
		channels: input.song.tracks
			.map((track) => channelsByTrackId.get(track.id))
			.filter((channel): channel is AudioChannelDefinition => channel !== undefined),
		preservedChannelCount: pairing.pairs.length,
		newChannelCount: pairing.unmatchedRight.length,
		droppedChannelCount: pairing.unmatchedLeft.length
	};
}
