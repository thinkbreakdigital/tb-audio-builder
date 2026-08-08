import type { AudioEngine } from '@thinkbreak/audio-runtime';

export interface AnimationFrameScheduler {
	request(callback: (timeMs: number) => void): number;
	cancel(id: number): void;
}

export interface PlaybackSampler {
	applyEngineSnapshot(snapshot: {
		transportStatus: 'stopped' | 'playing' | 'paused';
		positionTicks: number;
		positionSeconds: number;
		durationTicks: number;
		durationSeconds: number;
		audioContextStatus: 'uninitialized' | 'running' | 'suspended' | 'failed';
		activeVoiceCount: number;
		lastPlaybackError: string | null;
	}): void;
	setMeterLevels(levels: Record<string, number>, master: number): void;
	setTransportStatus?(status: 'stopped' | 'playing' | 'paused'): void;
	setLastPlaybackError?(error: string | null): void;
}

export function createPlaybackPoller(input: {
	engine: () => AudioEngine | null;
	state: PlaybackSampler;
	frames: AnimationFrameScheduler;
	isVisible: () => boolean;
	isReducedMotion: () => boolean;
	nowMs?: () => number;
}) {
	const nowMs = input.nowMs ?? (() => performance.now());
	let frameId: number | null = null;
	let disposed = false;
	let lastMeterAtMs = Number.NEGATIVE_INFINITY;
	let channelIds: string[] = [];
	let includeMaster = false;

	function sample(timeMs: number, forceMeters = false): 'playing' | 'paused' | 'stopped' | null {
		try {
			const engine = input.engine();
			if (engine === null) {
				input.state.setTransportStatus?.('stopped');
				return null;
			}
			const engineContextStatus = engine.audioContextStatus;
			const context = engineContextStatus === 'closed' ? 'uninitialized' : engineContextStatus;
			const status = engine.status;
			input.state.applyEngineSnapshot({
				transportStatus: status,
				positionTicks: engine.positionTicks,
				positionSeconds: engine.positionSeconds,
				durationTicks: engine.durationTicks,
				durationSeconds: engine.durationSeconds,
				audioContextStatus: context,
				activeVoiceCount: engine.activeVoiceCount,
				lastPlaybackError: engine.lastPlaybackError?.message ?? null
			});
			if (channelIds.length === 0 && !includeMaster) {
				input.state.setMeterLevels({}, 0);
				return status;
			}
			const meterInterval = input.isReducedMotion() ? 200 : 50;
			if (forceMeters || timeMs - lastMeterAtMs >= meterInterval) {
				const levels = Object.fromEntries(
					channelIds.map((id) => [id, engine.readChannelLevel(id)])
				);
				input.state.setMeterLevels(levels, includeMaster ? engine.readMasterLevel() : 0);
				lastMeterAtMs = timeMs;
			}
			return status;
		} catch (error) {
			// The engine may be disposed between the owner lookup and a synchronous read.
			input.state.setLastPlaybackError?.(
				`Unable to sample playback: ${error instanceof Error ? error.message : String(error)}`
			);
			input.state.setTransportStatus?.('stopped');
			return null;
		}
	}

	function tick(timeMs: number): void {
		frameId = null;
		if (disposed || !input.isVisible()) return;
		if (sample(timeMs) === 'playing') schedule();
	}
	function schedule(): void {
		if (frameId === null && !disposed && input.isVisible()) frameId = input.frames.request(tick);
	}
	function stop(): void {
		if (frameId !== null) input.frames.cancel(frameId);
		frameId = null;
	}
	function sampleNow(timeMs = nowMs()): void {
		if (!disposed && input.isVisible()) sample(timeMs, true);
	}
	function setVisible(visible: boolean): void {
		if (!visible) {
			stop();
			return;
		}
		if (sample(nowMs(), true) === 'playing') schedule();
	}
	function start(): void {
		if (disposed || !input.isVisible()) return;
		if (sample(nowMs()) === 'playing') schedule();
	}
	return {
		start,
		stop,
		sampleNow,
		setVisible,
		setMeterTargets(ids: readonly string[], master: boolean): void {
			if (ids.some((id) => typeof id !== 'string' || id.trim().length === 0)) {
				throw new Error('Meter target IDs must be non-empty strings.');
			}
			channelIds = [...new Set(ids)];
			includeMaster = master;
			lastMeterAtMs = Number.NEGATIVE_INFINITY;
			input.state.setMeterLevels({}, 0);
		},
		get isRunning(): boolean {
			return frameId !== null;
		},
		dispose(): void {
			disposed = true;
			stop();
		}
	};
}
