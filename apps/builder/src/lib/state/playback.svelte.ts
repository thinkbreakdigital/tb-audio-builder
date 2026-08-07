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
let audioContextStatus = $state<AudioContextStatus>('uninitialized');
let activeVoiceCount = $state(0);

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
	get audioContextStatus(): AudioContextStatus {
		return audioContextStatus;
	},
	get activeVoiceCount(): number {
		return activeVoiceCount;
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

	setAudioContextStatus(status: AudioContextStatus): void {
		audioContextStatus = status;
	},

	setActiveVoiceCount(count: number): void {
		activeVoiceCount = count;
	}
};
