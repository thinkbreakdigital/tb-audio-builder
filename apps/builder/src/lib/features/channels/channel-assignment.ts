import {
	createDefaultPercussionInstrument,
	createDefaultPitchedInstrument,
	type AudioChannelDefinition,
	type ChannelRole,
	type CompiledSong,
	type InstrumentDefinition
} from '@thinkbreak/audio-runtime';
import { createChannelForTrack, pairByNameThenPosition } from '@thinkbreak/project-schema';
import type { TrackRoleSuggestion } from '@thinkbreak/midi-parser';

const CHANNEL_NAME_MAX_LENGTH = 120;

export function normalizeImportedChannelName(name: string, fallback: string): string {
	const normalized = name.trim().slice(0, CHANNEL_NAME_MAX_LENGTH);
	return normalized || fallback;
}

function createInstrumentForRole(role: ChannelRole): InstrumentDefinition | null {
	switch (role) {
		case 'pitched':
			return createDefaultPitchedInstrument();
		case 'percussion':
			return createDefaultPercussionInstrument();
		case 'ignored':
		case 'metadata':
			return null;
	}
}

/**
 * Returns a role-compatible instrument without replacing an existing compatible assignment.
 * The runtime factories return fresh deep clones, so every repair is safe to edit independently.
 */
export function reconcileChannelInstrument(
	role: ChannelRole,
	instrument: InstrumentDefinition | null
): InstrumentDefinition | null {
	if (role === 'ignored' || role === 'metadata') return null;
	return instrument?.kind === role ? instrument : createInstrumentForRole(role);
}

/**
 * Role changes replace playable instruments because pitched and percussion definitions are
 * incompatible. A no-op role selection retains a valid current assignment while repairing any
 * legacy mismatch.
 */
export function instrumentForRoleChange(input: {
	currentRole: ChannelRole;
	nextRole: ChannelRole;
	currentInstrument: InstrumentDefinition | null;
}): InstrumentDefinition | null {
	if (input.currentRole === input.nextRole) {
		return reconcileChannelInstrument(input.nextRole, input.currentInstrument);
	}
	return createInstrumentForRole(input.nextRole);
}

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
		name: normalizeImportedChannelName(track.sourceTrackName, `Track ${trackIndex + 1}`),
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
			name: normalizeImportedChannelName(pair.left.name, pair.right.name),
			role: pair.left.role,
			sourceTrackId: pair.right.track.id,
			enabled: pair.left.enabled,
			instrument: reconcileChannelInstrument(pair.left.role, pair.left.instrument),
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
				instrument: createInstrumentForRole(role)
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
