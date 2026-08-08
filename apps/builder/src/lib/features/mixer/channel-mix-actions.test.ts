import { createDefaultPitchedInstrument } from '@thinkbreak/audio-runtime';
import { createEmptyProject, createSoundSetFromProject } from '@thinkbreak/project-schema';
import { describe, expect, it, vi } from 'vitest';
import { createChannelMixActions, planChannelGainNormalization } from './channel-mix-actions.js';

const channel = {
	id: 'a',
	name: 'A',
	role: 'pitched',
	sourceTrackId: null,
	enabled: true,
	instrument: { kind: 'pitched' },
	mix: { gain: 0.8, pan: 0, muted: false, soloed: false }
};
const project = {
	channels: [channel],
	master: {
		gain: 0.8,
		compressor: {
			enabled: true,
			thresholdDb: -12,
			kneeDb: 6,
			ratio: 4,
			attackSeconds: 0.01,
			releaseSeconds: 0.2
		}
	}
};

function createState(current: unknown = project) {
	return {
		project: current as never,
		snapshot: vi.fn(() => (current === null ? null : structuredClone(current)) as never),
		updateChannelMix: vi.fn(),
		updateMaster: vi.fn(),
		replaceProject: vi.fn()
	};
}

function createActions(current: unknown = project, engine: unknown = null) {
	const state = createState(current);
	const syncProject = vi.fn();
	const statusState = { push: vi.fn() };
	return {
		actions: createChannelMixActions({
			projectState: state,
			engineClient: { engine: engine as never, syncProject },
			statusState
		}),
		state,
		statusState,
		syncProject
	};
}

describe('channel mix actions', () => {
	it('keeps live gain/pan engine-only and commits once without initialized audio', () => {
		const { actions, state } = createActions();
		expect(actions.setChannelGain('a', 0.5, 'live')).toBe(false);
		expect(actions.setChannelPan('a', -0.25, 'live')).toBe(false);
		expect(state.updateChannelMix).not.toHaveBeenCalled();

		expect(actions.setChannelGain('a', 0.5, 'commit')).toBe(true);
		expect(actions.setChannelPan('a', -0.25, 'commit')).toBe(true);
		expect(state.updateChannelMix).toHaveBeenNthCalledWith(1, 'a', { gain: 0.5 });
		expect(state.updateChannelMix).toHaveBeenNthCalledWith(2, 'a', { pan: -0.25 });
	});

	it('rejects invalid, unknown, and non-playable writes before mutation', () => {
		const ignored = { ...channel, id: 'ignored', role: 'ignored', instrument: null };
		const { actions, state } = createActions({ ...project, channels: [channel, ignored] });
		expect(() => actions.setChannelGain('a', 2, 'commit')).toThrow(/0 to 1/);
		expect(() => actions.setChannelGain('missing', 0.5, 'commit')).toThrow(/not found/);
		expect(() => actions.setChannelGain('ignored', 0.5, 'commit')).toThrow(/not a playable/);
		expect(() => actions.setChannelGain('a', 0.5, 'other' as never)).toThrow(/live or commit/);
		expect(() => actions.setChannelMuted('a', 'yes' as never)).toThrow(/boolean/);
		expect(state.updateChannelMix).not.toHaveBeenCalled();
	});

	it('keeps committed state when the engine mirror fails and reports the failure', () => {
		const engine = {
			setChannelVolume: vi.fn(() => {
				throw new Error('gone');
			})
		};
		const { actions, state, statusState } = createActions(project, engine);
		expect(actions.setChannelGain('a', 0.5, 'commit')).toBe(true);
		expect(state.updateChannelMix).toHaveBeenCalledWith('a', { gain: 0.5 });
		expect(statusState.push).toHaveBeenCalledWith('error', expect.stringContaining('gone'));
	});

	it('separates live and committed master gain/compressor updates', () => {
		const engine = { setMasterVolume: vi.fn(), setMasterCompressor: vi.fn() };
		const { actions, state } = createActions(project, engine);
		actions.setMasterGain(0.5, 'live');
		actions.setMasterCompressor(project.master.compressor, 'live');
		expect(state.updateMaster).not.toHaveBeenCalled();
		expect(engine.setMasterVolume).toHaveBeenCalledWith(0.5);
		expect(engine.setMasterCompressor).toHaveBeenCalledTimes(1);

		actions.setMasterGain(0.6, 'commit');
		actions.setMasterCompressor({ ...project.master.compressor, ratio: 8 }, 'commit');
		expect(state.updateMaster).toHaveBeenCalledTimes(2);
		expect(() =>
			actions.setMasterCompressor({ ...project.master.compressor, ratio: 21 }, 'commit')
		).toThrow();
		expect(state.updateMaster).toHaveBeenCalledTimes(2);
	});

	it('does not send live master changes when no project is open', () => {
		const engine = { setMasterVolume: vi.fn(), setMasterCompressor: vi.fn() };
		const { actions } = createActions(null, engine);
		expect(() => actions.setMasterGain(0.5, 'live')).toThrow(/no project/);
		expect(() => actions.setMasterCompressor(project.master.compressor, 'live')).toThrow(
			/no project/
		);
		expect(engine.setMasterVolume).not.toHaveBeenCalled();
		expect(engine.setMasterCompressor).not.toHaveBeenCalled();
	});

	it('normalizes four audible playable channels through one snapshot replacement and sync', () => {
		const channels = Array.from({ length: 4 }, (_, index) => ({
			...channel,
			id: `channel-${index}`,
			mix: { ...channel.mix, gain: 0.8 - index * 0.1 }
		}));
		const multi = { ...project, channels };
		const { actions, state, syncProject } = createActions(multi);
		const factor = actions.normalizeChannelGains();
		expect(factor).toBe(0.5);
		expect(state.snapshot).toHaveBeenCalledTimes(1);
		expect(state.replaceProject).toHaveBeenCalledTimes(1);
		expect(syncProject).toHaveBeenCalledTimes(1);
		const replacement = state.replaceProject.mock.calls[0]?.[0];
		const gains = replacement.channels.map((item: typeof channel) => item.mix.gain);
		[0.4, 0.35, 0.3, 0.25].forEach((expected, index) => expect(gains[index]).toBeCloseTo(expected));
		expect(multi.channels[0]!.mix.gain).toBe(0.8);
		const preview = planChannelGainNormalization(structuredClone(multi) as never);
		expect(preview.factor).toBe(0.5);
		expect(preview.changedChannelIds).toHaveLength(4);
		expect(multi.channels[0]!.mix.gain).toBe(0.8);
	});

	it('excludes muted, disabled, non-playable, and solo-suppressed channels from normalization', () => {
		const soloed = { ...channel, id: 'soloed', mix: { ...channel.mix, soloed: true } };
		const suppressed = { ...channel, id: 'suppressed' };
		const muted = { ...channel, id: 'muted', mix: { ...channel.mix, muted: true } };
		const disabled = { ...channel, id: 'disabled', enabled: false };
		const ignored = { ...channel, id: 'ignored', role: 'ignored', instrument: null };
		const current = { ...project, channels: [soloed, suppressed, muted, disabled, ignored] };
		const { actions, state, syncProject } = createActions(current);
		expect(actions.normalizeChannelGains()).toBe(1);
		expect(state.replaceProject).not.toHaveBeenCalled();
		expect(syncProject).not.toHaveBeenCalled();
	});

	it('applies a confirmed sound set as one validated replacement followed by one sync', () => {
		const current = createEmptyProject({ name: 'Current' });
		current.channels = [
			{
				id: crypto.randomUUID(),
				name: 'Lead',
				role: 'pitched',
				sourceTrackId: null,
				enabled: true,
				instrument: createDefaultPitchedInstrument(),
				mix: { gain: 0.8, pan: 0, muted: false, soloed: false }
			}
		];
		const source = structuredClone(current);
		source.channels[0]!.mix.gain = 0.25;
		const soundSet = createSoundSetFromProject({
			project: source,
			id: crypto.randomUUID(),
			name: 'Quiet lead',
			nowMs: 1
		});
		const { actions, state, syncProject } = createActions(current);
		actions.applyConfirmedSoundSet(soundSet);
		expect(state.snapshot).toHaveBeenCalledTimes(1);
		expect(state.replaceProject).toHaveBeenCalledTimes(1);
		expect(state.replaceProject.mock.calls[0]?.[0].channels[0].mix.gain).toBe(0.25);
		expect(syncProject).toHaveBeenCalledTimes(1);

		state.replaceProject.mockClear();
		syncProject.mockClear();
		expect(() => actions.applyConfirmedSoundSet({} as never)).toThrow();
		expect(state.replaceProject).not.toHaveBeenCalled();
		expect(syncProject).not.toHaveBeenCalled();
	});
});
