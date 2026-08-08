import type { AudioEngine } from '@thinkbreak/audio-runtime';
import { describe, expect, it, vi } from 'vitest';
import { createPlaybackPoller } from './playback-poller.js';

function createEngine(status: 'playing' | 'paused' | 'stopped' = 'playing') {
	let currentStatus = status;
	const engine = {
		get status() {
			return currentStatus;
		},
		audioContextStatus: 'running',
		positionTicks: 1,
		positionSeconds: 1,
		durationTicks: 10,
		durationSeconds: 10,
		activeVoiceCount: 1,
		lastPlaybackError: null,
		readChannelLevel: vi.fn(() => 0.3),
		readMasterLevel: vi.fn(() => 0.4)
	} as unknown as AudioEngine;
	return { engine, setStatus: (next: typeof currentStatus) => (currentStatus = next) };
}

function createHarness(options: { reducedMotion?: boolean; visible?: boolean } = {}) {
	const callbacks: ((timeMs: number) => void)[] = [];
	let visible = options.visible ?? true;
	let now = 0;
	const runtime = createEngine();
	const frames = {
		request: vi.fn((callback: (timeMs: number) => void) => {
			callbacks.push(callback);
			return callbacks.length;
		}),
		cancel: vi.fn()
	};
	const state = {
		applyEngineSnapshot: vi.fn(),
		setMeterLevels: vi.fn(),
		setTransportStatus: vi.fn(),
		setLastPlaybackError: vi.fn()
	};
	const poller = createPlaybackPoller({
		engine: () => runtime.engine,
		state,
		frames,
		isVisible: () => visible,
		isReducedMotion: () => options.reducedMotion ?? false,
		nowMs: () => now
	});
	return {
		callbacks,
		frames,
		poller,
		runtime,
		state,
		setNow: (value: number) => (now = value),
		setVisible: (value: boolean) => (visible = value)
	};
}

describe('playback poller', () => {
	it('owns one frame loop and stops after sampling natural completion', () => {
		const harness = createHarness();
		harness.poller.start();
		harness.poller.start();
		expect(harness.frames.request).toHaveBeenCalledTimes(1);
		expect(harness.poller.isRunning).toBe(true);

		harness.runtime.setStatus('stopped');
		harness.callbacks[0]?.(16);
		expect(harness.state.applyEngineSnapshot).toHaveBeenLastCalledWith(
			expect.objectContaining({ transportStatus: 'stopped' })
		);
		expect(harness.frames.request).toHaveBeenCalledTimes(1);
		expect(harness.poller.isRunning).toBe(false);
	});

	it('throttles targeted meters at 20Hz and supports a master-only target', () => {
		const harness = createHarness();
		harness.poller.setMeterTargets(['lead'], true);
		harness.poller.start();
		expect(harness.runtime.engine.readChannelLevel).toHaveBeenCalledWith('lead');
		expect(harness.runtime.engine.readMasterLevel).toHaveBeenCalledTimes(1);

		harness.callbacks.at(-1)?.(25);
		expect(harness.runtime.engine.readChannelLevel).toHaveBeenCalledTimes(1);
		harness.callbacks.at(-1)?.(50);
		expect(harness.runtime.engine.readChannelLevel).toHaveBeenCalledTimes(2);

		harness.poller.setMeterTargets([], true);
		harness.setNow(60);
		harness.poller.sampleNow();
		expect(harness.state.setMeterLevels).toHaveBeenLastCalledWith({}, 0.4);
	});

	it('uses the reduced-motion 5Hz meter rate and performs no analyser reads without targets', () => {
		const harness = createHarness({ reducedMotion: true });
		harness.poller.start();
		expect(harness.runtime.engine.readChannelLevel).not.toHaveBeenCalled();
		expect(harness.runtime.engine.readMasterLevel).not.toHaveBeenCalled();

		harness.poller.setMeterTargets(['lead'], false);
		harness.setNow(10);
		harness.poller.sampleNow();
		harness.callbacks.at(-1)?.(199);
		expect(harness.runtime.engine.readChannelLevel).toHaveBeenCalledTimes(1);
		harness.callbacks.at(-1)?.(210);
		expect(harness.runtime.engine.readChannelLevel).toHaveBeenCalledTimes(2);
	});

	it('does no hidden work and force-samples once when visibility returns', () => {
		const harness = createHarness({ visible: false });
		harness.poller.setMeterTargets(['lead'], false);
		harness.poller.start();
		expect(harness.state.applyEngineSnapshot).not.toHaveBeenCalled();
		expect(harness.frames.request).not.toHaveBeenCalled();

		harness.setVisible(true);
		harness.setNow(100);
		harness.poller.setVisible(true);
		expect(harness.state.applyEngineSnapshot).toHaveBeenCalledTimes(1);
		expect(harness.runtime.engine.readChannelLevel).toHaveBeenCalledTimes(1);
		expect(harness.frames.request).toHaveBeenCalledTimes(1);
	});

	it('clears stale targets immediately and cancels teardown safely', () => {
		const harness = createHarness();
		harness.poller.setMeterTargets(['old', 'old'], true);
		harness.poller.start();
		harness.poller.setMeterTargets([], false);
		expect(harness.state.setMeterLevels).toHaveBeenLastCalledWith({}, 0);
		expect(() => harness.poller.setMeterTargets([''], false)).toThrow(/non-empty/);

		const queued = harness.callbacks.at(-1);
		harness.poller.dispose();
		harness.poller.dispose();
		expect(harness.frames.cancel).toHaveBeenCalledTimes(1);
		queued?.(200);
		expect(harness.frames.request).toHaveBeenCalledTimes(1);
	});

	it('stops stale state for missing/disposed engines and reports contextual read errors', () => {
		const state = {
			applyEngineSnapshot: vi.fn(),
			setMeterLevels: vi.fn(),
			setTransportStatus: vi.fn(),
			setLastPlaybackError: vi.fn()
		};
		let runtime: AudioEngine | null = null;
		const poller = createPlaybackPoller({
			engine: () => runtime,
			state,
			frames: { request: vi.fn(), cancel: vi.fn() },
			isVisible: () => true,
			isReducedMotion: () => false,
			nowMs: () => 0
		});
		poller.sampleNow();
		expect(state.setTransportStatus).toHaveBeenCalledWith('stopped');

		runtime = {
			get audioContextStatus() {
				throw new Error('disposed');
			}
		} as unknown as AudioEngine;
		poller.sampleNow();
		expect(state.setLastPlaybackError).toHaveBeenCalledWith('Unable to sample playback: disposed');
		expect(state.setTransportStatus).toHaveBeenLastCalledWith('stopped');
	});
});
