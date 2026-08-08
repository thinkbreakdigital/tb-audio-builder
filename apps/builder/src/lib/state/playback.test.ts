import { describe, expect, it } from 'vitest';
import { playbackState } from './playback.svelte.js';

describe('playback state', () => {
	it('resets every engine-owned field and keeps a master clip latch until explicitly cleared', () => {
		playbackState.applyEngineSnapshot({
			transportStatus: 'playing',
			positionTicks: 32,
			positionSeconds: 1,
			durationTicks: 64,
			durationSeconds: 2,
			audioContextStatus: 'running',
			activeVoiceCount: 2,
			lastPlaybackError: 'previous failure'
		});
		playbackState.setMeterLevels({ piano: 0.5 }, 1);
		expect(playbackState.masterClipLatched).toBe(true);
		playbackState.setMeterLevels({ piano: 0.1 }, 0.1);
		expect(playbackState.masterClipLatched).toBe(true);
		playbackState.resetMasterClip();
		expect(playbackState.masterClipLatched).toBe(false);
		playbackState.setMeterLevels({ piano: 0.5 }, 1);
		playbackState.reset();
		expect(playbackState).toMatchObject({
			transportStatus: 'stopped',
			positionTicks: 0,
			positionSeconds: 0,
			durationTicks: 0,
			durationSeconds: 0,
			audioContextStatus: 'uninitialized',
			activeVoiceCount: 0,
			lastPlaybackError: null,
			channelLevels: {},
			masterLevel: 0,
			masterClipLatched: false
		});
	});
});
