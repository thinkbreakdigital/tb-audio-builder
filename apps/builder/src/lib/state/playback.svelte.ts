/**
 * Runtime playback state. Declaration only in phase 04 — populated by the audio engine in
 * phase 06. No audio or DOM imports here.
 */

export type TransportStatus = 'stopped' | 'playing' | 'paused';
export type AudioContextStatus = 'uninitialized' | 'running' | 'suspended' | 'failed';

let transportStatus = $state<TransportStatus>('stopped');
let positionTicks = $state(0);
let positionSeconds = $state(0);
let durationSeconds = $state(0);
let durationTicks = $state(0);
let audioContextStatus = $state<AudioContextStatus>('uninitialized');
let activeVoiceCount = $state(0);
let lastPlaybackError = $state<string | null>(null);
let channelLevels = $state<Record<string, number>>({});
let masterLevel = $state(0);
let masterClipLatched = $state(false);

export const playbackState = {
	get transportStatus(): TransportStatus {
		return transportStatus;
	},
	get positionTicks(): number {
		return positionTicks;
	},
	get positionSeconds(): number {
		return positionSeconds;
	},
	get durationSeconds(): number {
		return durationSeconds;
	},
	get durationTicks(): number {
		return durationTicks;
	},
	get audioContextStatus(): AudioContextStatus {
		return audioContextStatus;
	},
	get activeVoiceCount(): number {
		return activeVoiceCount;
	},
	get lastPlaybackError(): string | null {
		return lastPlaybackError;
	},
	get channelLevels(): Readonly<Record<string, number>> {
		return channelLevels;
	},
	get masterLevel(): number {
		return masterLevel;
	},
	get masterClipLatched(): boolean {
		return masterClipLatched;
	},

	setTransportStatus(status: TransportStatus): void {
		transportStatus = status;
	},

	setPositionTicks(ticks: number): void {
		positionTicks = ticks;
	},

	setPositionSeconds(seconds: number): void {
		positionSeconds = seconds;
	},

	setDurationSeconds(seconds: number): void {
		durationSeconds = seconds;
	},
	setDurationTicks(ticks: number): void {
		durationTicks = ticks;
	},

	setAudioContextStatus(status: AudioContextStatus): void {
		audioContextStatus = status;
	},

	setActiveVoiceCount(count: number): void {
		activeVoiceCount = count;
	},
	setLastPlaybackError(error: string | null): void {
		lastPlaybackError = error;
	},
	setMeterLevels(levels: Record<string, number>, master: number): void {
		channelLevels = { ...levels };
		masterLevel = master;
		if (master >= 1) masterClipLatched = true;
	},
	resetMasterClip(): void {
		masterClipLatched = false;
	},
	reset(): void {
		transportStatus = 'stopped';
		positionTicks = 0;
		positionSeconds = 0;
		durationTicks = 0;
		durationSeconds = 0;
		audioContextStatus = 'uninitialized';
		activeVoiceCount = 0;
		lastPlaybackError = null;
		channelLevels = {};
		masterLevel = 0;
		masterClipLatched = false;
	},
	applyEngineSnapshot(snapshot: {
		transportStatus: TransportStatus;
		positionTicks: number;
		positionSeconds: number;
		durationTicks: number;
		durationSeconds: number;
		audioContextStatus: AudioContextStatus;
		activeVoiceCount: number;
		lastPlaybackError: string | null;
	}): void {
		transportStatus = snapshot.transportStatus;
		positionTicks = snapshot.positionTicks;
		positionSeconds = snapshot.positionSeconds;
		durationTicks = snapshot.durationTicks;
		durationSeconds = snapshot.durationSeconds;
		audioContextStatus = snapshot.audioContextStatus;
		activeVoiceCount = snapshot.activeVoiceCount;
		lastPlaybackError = snapshot.lastPlaybackError;
	}
};
