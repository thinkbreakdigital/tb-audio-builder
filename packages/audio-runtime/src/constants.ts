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

/** Tempo assumed when a song carries no tempo change at tick 0. */
export const DEFAULT_TEMPO_BPM = 120;

export const MIN_TEMPO_MULTIPLIER = 0.25;
export const MAX_TEMPO_MULTIPLIER = 4;

/**
 * Time constant for every `setTargetAtTime` gain and pan ramp. Direct `.value` writes click, so
 * the mixer never uses them during playback.
 */
export const PARAMETER_RAMP_TIME_CONSTANT_SECONDS = 0.01;

/** Hard-stop ramp used when a choke group cuts a sounding voice. */
export const CHOKE_STOP_RAMP_SECONDS = 0.005;

export const ANALYSER_FFT_SIZE = 256;
export const ANALYSER_SMOOTHING_TIME_CONSTANT = 0.4;

/**
 * A loop shorter than the look-ahead window wraps several times per scheduler invocation. Beyond
 * this many wraps the loop region is a configuration error, not a fast loop.
 */
export const MAX_LOOP_WRAPS_PER_TICK = 64;

/** `triggerPreview` starts just ahead of `currentTime` so the attack is never scheduled late. */
export const PREVIEW_START_OFFSET_SECONDS = 0.005;
export const PREVIEW_RELEASE_SECONDS = 1;
