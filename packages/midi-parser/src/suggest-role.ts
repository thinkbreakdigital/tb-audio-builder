import type { ChannelRole } from '@thinkbreak/audio-runtime';

export const PERCUSSION_ROLE_PATTERNS = [
	'kick',
	'snare',
	'hat',
	'hihat',
	'tom',
	'clap',
	'perc',
	'drum',
	'noise',
	'click',
	'crash',
	'ride',
	'rim',
	'shaker',
	'cym'
] as const;

export const METADATA_ROLE_PATTERNS = [
	'meta',
	'marker',
	'tempo',
	'conductor',
	'map',
	'cue'
] as const;

export const IGNORED_ROLE_PATTERNS = ['mute', 'unused', 'ignore', 'off'] as const;

export const PITCHED_ROLE_PATTERNS = [
	'pulse',
	'tri',
	'saw',
	'square',
	'lead',
	'bass',
	'pad',
	'drone',
	'arp',
	'harmony',
	'signal',
	'melody',
	'chord',
	'string',
	'organ',
	'piano',
	'synth'
] as const;

function normalizeTrackName(name: string): string {
	return name.toLowerCase().replace(/[ _-]/g, '');
}

function findPattern(name: string, patterns: readonly string[]): string | undefined {
	return patterns.find((pattern) => name.includes(pattern));
}

export function suggestRoleForTrackName(name: string): {
	role: ChannelRole;
	reason: string;
	confidence: 'high' | 'low';
} {
	const normalizedName = normalizeTrackName(name);
	const percussionPattern = findPattern(normalizedName, PERCUSSION_ROLE_PATTERNS);
	if (percussionPattern !== undefined) {
		return {
			role: 'percussion',
			reason: `Track name matches the percussion pattern "${percussionPattern}".`,
			confidence: 'high'
		};
	}

	const metadataPattern = findPattern(normalizedName, METADATA_ROLE_PATTERNS);
	if (metadataPattern !== undefined) {
		return {
			role: 'metadata',
			reason: `Track name matches the metadata pattern "${metadataPattern}".`,
			confidence: 'high'
		};
	}

	const ignoredPattern = findPattern(normalizedName, IGNORED_ROLE_PATTERNS);
	if (ignoredPattern !== undefined) {
		return {
			role: 'ignored',
			reason: `Track name matches the ignored pattern "${ignoredPattern}".`,
			confidence: 'high'
		};
	}

	const pitchedPattern = findPattern(normalizedName, PITCHED_ROLE_PATTERNS);
	if (pitchedPattern !== undefined) {
		return {
			role: 'pitched',
			reason: `Track name matches the pitched pattern "${pitchedPattern}".`,
			confidence: 'high'
		};
	}

	return {
		role: 'pitched',
		reason: 'No name pattern matched; defaulting to pitched.',
		confidence: 'low'
	};
}
