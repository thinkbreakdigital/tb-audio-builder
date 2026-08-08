import { describe, expect, it, vi } from 'vitest';
import { createTransportActions } from './transport-actions.js';

const song = { durationTicks: 960 };
const project = {
	song,
	transport: { tempoMultiplier: 1, loopEnabled: false, loopStartTick: 0, loopEndTick: 960 }
};

function createActions(engine: unknown = null) {
	const projectState = { project: project as never, updateTransport: vi.fn() };
	const statusState = { push: vi.fn() };
	const poller = { start: vi.fn(), stop: vi.fn(), sampleNow: vi.fn() };
	const ensureInitialized = vi.fn(async () => (engine ?? null) as never);
	return {
		ensureInitialized,
		projectState,
		statusState,
		poller,
		actions: createTransportActions({
			engineClient: {
				engine: engine as never,
				ensureInitialized
			},
			projectState,
			statusState,
			poller
		})
	};
}

describe('transport actions', () => {
	it('persists a tempo commit without audio, while a live-only update requires audio', () => {
		const { actions, projectState, statusState } = createActions();
		expect(actions.setTempo(1.5, 'commit')).toBe(true);
		expect(projectState.updateTransport).toHaveBeenCalledWith({ tempoMultiplier: 1.5 });
		expect(actions.setTempo(1.5, 'live')).toBe(false);
		expect(actions.setTempo(1.5, 'unexpected' as never)).toBe(false);
		expect(projectState.updateTransport).toHaveBeenCalledTimes(1);
		expect(statusState.push).toHaveBeenLastCalledWith(
			'error',
			expect.stringContaining('live or commit')
		);
	});

	it('validates seeks against both the project and loaded engine duration', () => {
		const { actions, statusState } = createActions({ durationSeconds: 2, seekToSeconds: vi.fn() });
		expect(actions.seekToSeconds(3)).toBe(false);
		expect(statusState.push).toHaveBeenCalledWith('error', expect.stringContaining('0 to 2'));
	});

	it('does not persist an invalid stored region while enabling loop', () => {
		const invalidProject = {
			...project,
			transport: { ...project.transport, loopStartTick: 20, loopEndTick: 20 }
		};
		const projectState = { project: invalidProject as never, updateTransport: vi.fn() };
		const actions = createTransportActions({
			engineClient: { engine: null, ensureInitialized: vi.fn() },
			projectState,
			statusState: { push: vi.fn() }
		});
		expect(actions.setLoop(true)).toBe(false);
		expect(projectState.updateTransport).not.toHaveBeenCalled();
	});

	it('rejects a supplied invalid region even while disabling loop', () => {
		const engine = { setLoopRegion: vi.fn(), setLoopEnabled: vi.fn() };
		const { actions, projectState } = createActions(engine);
		expect(actions.setLoop(false, { startTick: 20, endTick: 20 })).toBe(false);
		expect(projectState.updateTransport).not.toHaveBeenCalled();
		expect(engine.setLoopRegion).not.toHaveBeenCalled();
		expect(engine.setLoopEnabled).not.toHaveBeenCalled();
	});

	it('commits a valid loop once and mirrors both region and enabled state', () => {
		const engine = { setLoopRegion: vi.fn(), setLoopEnabled: vi.fn() };
		const { actions, projectState } = createActions(engine);
		expect(actions.setLoop(true, { startTick: 120, endTick: 840 })).toBe(true);
		expect(projectState.updateTransport).toHaveBeenCalledTimes(1);
		expect(projectState.updateTransport).toHaveBeenCalledWith({
			loopEnabled: true,
			loopStartTick: 120,
			loopEndTick: 840
		});
		expect(engine.setLoopRegion).toHaveBeenCalledWith(120, 840);
		expect(engine.setLoopEnabled).toHaveBeenCalledWith(true);
	});

	it('starts or samples the poller after successful engine transport actions', async () => {
		const engine = {
			play: vi.fn(),
			pause: vi.fn(),
			stop: vi.fn(),
			seekToTicks: vi.fn(),
			durationSeconds: 2
		};
		const { actions, poller } = createActions(engine);
		await actions.play();
		actions.pause();
		actions.seekToTicks(10);
		expect(poller.start).toHaveBeenCalledTimes(1);
		expect(poller.stop).toHaveBeenCalledTimes(1);
		expect(poller.sampleNow).toHaveBeenCalledTimes(2);
	});

	it('initializes once for play and reports a thrown playback failure', async () => {
		const engine = {
			play: vi.fn(() => {
				throw new Error('context suspended');
			})
		};
		const { actions, ensureInitialized, poller, statusState } = createActions(engine);
		await expect(actions.play()).resolves.toBe(false);
		expect(ensureInitialized).toHaveBeenCalledTimes(1);
		expect(poller.start).not.toHaveBeenCalled();
		expect(statusState.push).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('context suspended')
		);
	});
});
