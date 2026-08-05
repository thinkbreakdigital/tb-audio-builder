import type { ChannelMixSettings } from './types/channel.js';
import type { CompressorSettings } from './types/project.js';

export const PROJECT_SCHEMA_VERSION = 1;
export const SONG_SCHEMA_VERSION = 1;
export const SOUND_SET_SCHEMA_VERSION = 1;

export const DEFAULT_SCHEDULER_SETTINGS = {
	lookaheadMs: 100,
	intervalMs: 25
} as const;

export const DEFAULT_AUDIO_LIMITS = {
	maxTracks: 16,
	maxTotalVoices: 32,
	maxVoicesPerChannel: 8,
	maxDroneVoices: 2
} as const;

export const DEFAULT_COMPRESSOR = {
	enabled: true,
	thresholdDb: -12,
	kneeDb: 6,
	ratio: 4,
	attackSeconds: 0.003,
	releaseSeconds: 0.25
} as const satisfies CompressorSettings;

export const DEFAULT_CHANNEL_MIX = {
	gain: 0.8,
	pan: 0,
	muted: false,
	soloed: false
} as const satisfies ChannelMixSettings;

export const DEFAULT_MASTER_GAIN = 0.8;
export const DEFAULT_TEMPO_MULTIPLIER = 1;
