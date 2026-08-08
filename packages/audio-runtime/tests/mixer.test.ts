import { describe, expect, it } from 'vitest';
import {
	DEFAULT_CHANNEL_MIX,
	DEFAULT_COMPRESSOR,
	DEFAULT_MASTER_GAIN,
	PARAMETER_RAMP_TIME_CONSTANT_SECONDS
} from '../src/constants.js';
import {
	createAudioContextController,
	type AudioContextStatus
} from '../src/engine/audio-context.js';
import { AudioInitializationError, PlaybackError } from '../src/errors.js';
import { createChannelBus } from '../src/mixer/channel-bus.js';
import { createMasterBus } from '../src/mixer/master-bus.js';
import {
	asBaseAudioContext,
	asFakeCompressorNode,
	asFakeGainNode,
	asFakeStereoPannerNode,
	createFakeAudioContext,
	type FakeAudioNode
} from './fakes/fake-audio-context.js';

function buildTestChannelBus(mix = DEFAULT_CHANNEL_MIX) {
	const fakeContext = createFakeAudioContext();
	const context = asBaseAudioContext(fakeContext);
	const destinationStub = context.createGain();
	const bus = createChannelBus({ context, channelId: 'ch-1', destination: destinationStub, mix });

	// Reaching back into the fake to assert graph wiring; production code never does this cast —
	// it only ever holds the real AudioNode type returned by the DOM API.
	const gainNode = bus.input as unknown as FakeAudioNode;
	const pannerNode = gainNode.connectedTo[0]!;
	const analyserNode = pannerNode.connectedTo[0]!;

	return {
		fakeContext,
		bus,
		gainNode,
		pannerNode,
		analyserNode,
		destinationNode: destinationStub as unknown as FakeAudioNode
	};
}

function buildTestMasterBus(compressor = DEFAULT_COMPRESSOR) {
	const fakeContext = createFakeAudioContext();
	const context = asBaseAudioContext(fakeContext);
	const masterBus = createMasterBus({
		context,
		settings: { gain: DEFAULT_MASTER_GAIN, compressor }
	});

	const gainNode = masterBus.input as unknown as FakeAudioNode;
	const compressorNode = gainNode.connectedTo[0]!;
	const analyserNode = compressorNode.connectedTo[0]!;

	return { fakeContext, masterBus, gainNode, compressorNode, analyserNode };
}

describe('createChannelBus', () => {
	it('connects the channel graph in the documented order', () => {
		const { gainNode, pannerNode, analyserNode, destinationNode } = buildTestChannelBus();

		expect(gainNode.nodeKind).toBe('gain');
		expect(pannerNode.nodeKind).toBe('stereo-panner');
		expect(analyserNode.nodeKind).toBe('analyser');
		expect(analyserNode.connectedTo).toHaveLength(1);
		expect(analyserNode.connectedTo[0]).toBe(destinationNode);
	});

	it('setGain schedules via setTargetAtTime, never a direct value write', () => {
		const { bus, gainNode } = buildTestChannelBus();

		bus.setGain(0.5, 1.25);

		const gainParam = asFakeGainNode(gainNode).gain;
		const lastCall = gainParam.automation.at(-1);
		expect(lastCall).toMatchObject({
			method: 'setTargetAtTime',
			value: 0.5,
			atSeconds: 1.25,
			timeConstantSeconds: PARAMETER_RAMP_TIME_CONSTANT_SECONDS
		});
	});

	it('setPan schedules via setTargetAtTime, never a direct value write', () => {
		const { bus, pannerNode } = buildTestChannelBus();

		bus.setPan(-0.5, 2);

		const panParam = asFakeStereoPannerNode(pannerNode).pan;
		expect(panParam.automation.at(-1)).toMatchObject({
			method: 'setTargetAtTime',
			value: -0.5,
			atSeconds: 2,
			timeConstantSeconds: PARAMETER_RAMP_TIME_CONSTANT_SECONDS
		});
	});

	it('setAudible(false) ramps gain to zero without disconnecting', () => {
		const { bus, gainNode } = buildTestChannelBus();

		bus.setAudible(false, 2);

		const gainParam = asFakeGainNode(gainNode).gain;
		const lastCall = gainParam.automation.at(-1);
		expect(lastCall).toMatchObject({ method: 'setTargetAtTime', value: 0, atSeconds: 2 });
		expect(gainNode.disconnectCallCount).toBe(0);
		expect(gainNode.disposed).toBe(false);
	});

	it('setGain while inaudible stores without unmuting; setAudible(true) restores it', () => {
		const { bus, gainNode } = buildTestChannelBus();
		const gainParam = asFakeGainNode(gainNode).gain;

		bus.setAudible(false, 1);
		expect(gainParam.value).toBe(0);

		bus.setGain(0.3, 1.1);
		expect(gainParam.value).toBe(0); // still muted; setGain must not have ramped the node

		bus.setAudible(true, 1.2);
		const lastCall = gainParam.automation.at(-1);
		expect(lastCall).toMatchObject({ method: 'setTargetAtTime', value: 0.3, atSeconds: 1.2 });
	});

	it('readPeakLevel reuses the same buffer instance across calls', () => {
		const { bus, fakeContext } = buildTestChannelBus();

		bus.readPeakLevel();
		bus.readPeakLevel();

		const buffers = fakeContext.timeDomainReadBuffers;
		expect(buffers).toHaveLength(2);
		expect(buffers[0]).toBe(buffers[1]);
	});

	it('readPeakLevel returns the max absolute sample', () => {
		const { bus, fakeContext, analyserNode } = buildTestChannelBus();

		fakeContext.setAnalyserSamples(analyserNode, [0.1, -0.9, 0.4]);

		expect(bus.readPeakLevel()).toBeCloseTo(0.9);
	});

	it('dispose disconnects every node the channel bus created', () => {
		const { bus, gainNode, pannerNode, analyserNode } = buildTestChannelBus();

		bus.dispose();

		expect(gainNode.disposed).toBe(true);
		expect(pannerNode.disposed).toBe(true);
		expect(analyserNode.disposed).toBe(true);
	});

	it('throws a contextual error on any call after dispose', () => {
		const { bus } = buildTestChannelBus();

		bus.dispose();

		expect(() => bus.setGain(0.1, 0)).toThrow(PlaybackError);
		expect(() => bus.setGain(0.1, 0)).toThrow(/ch-1/);
		expect(() => bus.dispose()).toThrow(PlaybackError);
	});
});

describe('createMasterBus', () => {
	it('connects the master graph in the documented order', () => {
		const { fakeContext, gainNode, compressorNode, analyserNode } = buildTestMasterBus();

		expect(gainNode.nodeKind).toBe('gain');
		expect(compressorNode.nodeKind).toBe('compressor');
		expect(analyserNode.nodeKind).toBe('analyser');
		expect(analyserNode.connectedTo).toHaveLength(1);
		expect(analyserNode.connectedTo[0]).toBe(fakeContext.destination);
	});

	it('setGain schedules via setTargetAtTime', () => {
		const { masterBus, gainNode } = buildTestMasterBus();

		masterBus.setGain(0.6, 3);

		const gainParam = asFakeGainNode(gainNode).gain;
		expect(gainParam.automation.at(-1)).toMatchObject({
			method: 'setTargetAtTime',
			value: 0.6,
			atSeconds: 3
		});
	});

	it('a disabled compressor is bypassed by parameter values, not rewiring', () => {
		const { masterBus, compressorNode } = buildTestMasterBus({
			...DEFAULT_COMPRESSOR,
			enabled: true
		});
		const compressor = asFakeCompressorNode(compressorNode);
		const connectCallsBefore = compressor.connectCallCount;
		const disconnectCallsBefore = compressor.disconnectCallCount;

		masterBus.setCompressor({ ...DEFAULT_COMPRESSOR, enabled: false }, 5);

		expect(compressor.threshold.automation.at(-1)).toMatchObject({
			method: 'setTargetAtTime',
			value: 0,
			atSeconds: 5
		});
		expect(compressor.ratio.automation.at(-1)).toMatchObject({ value: 1 });
		expect(compressor.knee.automation.at(-1)).toMatchObject({ value: 0 });
		expect(compressor.connectCallCount).toBe(connectCallsBefore);
		expect(compressor.disconnectCallCount).toBe(disconnectCallsBefore);
	});

	it('an enabled compressor applies its full settings', () => {
		const { masterBus, compressorNode } = buildTestMasterBus();
		const compressor = asFakeCompressorNode(compressorNode);

		masterBus.setCompressor(
			{
				enabled: true,
				thresholdDb: -20,
				kneeDb: 10,
				ratio: 8,
				attackSeconds: 0.01,
				releaseSeconds: 0.4
			},
			1
		);

		expect(compressor.threshold.automation.at(-1)).toMatchObject({ value: -20 });
		expect(compressor.knee.automation.at(-1)).toMatchObject({ value: 10 });
		expect(compressor.ratio.automation.at(-1)).toMatchObject({ value: 8 });
		expect(compressor.attack.automation.at(-1)).toMatchObject({ value: 0.01 });
		expect(compressor.release.automation.at(-1)).toMatchObject({ value: 0.4 });
	});

	it('readPeakLevel reuses the same buffer instance across calls', () => {
		const { masterBus, fakeContext } = buildTestMasterBus();

		masterBus.readPeakLevel();
		masterBus.readPeakLevel();

		const buffers = fakeContext.timeDomainReadBuffers;
		expect(buffers).toHaveLength(2);
		expect(buffers[0]).toBe(buffers[1]);
	});

	it('dispose disconnects every node the master bus created', () => {
		const { masterBus, gainNode, compressorNode, analyserNode } = buildTestMasterBus();

		masterBus.dispose();

		expect(gainNode.disposed).toBe(true);
		expect(compressorNode.disposed).toBe(true);
		expect(analyserNode.disposed).toBe(true);
	});

	it('throws a contextual error on any call after dispose', () => {
		const { masterBus } = buildTestMasterBus();

		masterBus.dispose();

		expect(() => masterBus.setGain(0.1, 0)).toThrow(PlaybackError);
		expect(() => masterBus.dispose()).toThrow(PlaybackError);
	});
});

describe('createAudioContextController', () => {
	it('is uninitialized with currentTimeSeconds 0 before initialize()', () => {
		const controller = createAudioContextController({
			contextFactory: () => asBaseAudioContext(createFakeAudioContext())
		});

		expect(controller.status).toBe('uninitialized');
		expect(controller.context).toBeNull();
		expect(controller.currentTimeSeconds).toBe(0);
	});

	it('creates exactly one context, lazily, on the first initialize()', async () => {
		let factoryCalls = 0;
		const fakeContext = createFakeAudioContext();
		const controller = createAudioContextController({
			contextFactory: () => {
				factoryCalls += 1;
				return asBaseAudioContext(fakeContext);
			}
		});

		expect(factoryCalls).toBe(0);
		await controller.initialize();
		expect(factoryCalls).toBe(1);
		expect(controller.status).toBe('running');

		await controller.initialize();
		expect(factoryCalls).toBe(1);
	});

	it('shares one in-flight attempt across concurrent initialize() calls', async () => {
		let factoryCalls = 0;
		const fakeContext = createFakeAudioContext();
		const controller = createAudioContextController({
			contextFactory: () => {
				factoryCalls += 1;
				return asBaseAudioContext(fakeContext);
			}
		});

		await Promise.all([controller.initialize(), controller.initialize(), controller.initialize()]);

		expect(factoryCalls).toBe(1);
	});

	it('rejects with AudioInitializationError and sets status failed when creation throws', async () => {
		const statuses: AudioContextStatus[] = [];
		const controller = createAudioContextController({
			contextFactory: () => {
				throw new Error('boom');
			}
		});
		controller.onStatusChange((status) => statuses.push(status));

		await expect(controller.initialize()).rejects.toBeInstanceOf(AudioInitializationError);
		expect(controller.status).toBe('failed');
		expect(statuses).toContain('failed');
	});

	it('rejects with AudioInitializationError and sets status failed when resume() fails', async () => {
		const stubContext = {
			currentTime: 0,
			state: 'suspended' as const,
			destination: {},
			resume: () => Promise.reject(new Error('resume failed')),
			suspend: () => Promise.resolve(),
			close: () => Promise.resolve(),
			addEventListener: () => {},
			removeEventListener: () => {}
		};
		const controller = createAudioContextController({
			// Minimal stub for a resume-failure path the shared fake can't express (it never fails).
			// Justified `unknown` cast at this one boundary, per 00-conventions.md §4 rule 1.
			contextFactory: () => stubContext as unknown as BaseAudioContext
		});

		await expect(controller.initialize()).rejects.toBeInstanceOf(AudioInitializationError);
		expect(controller.status).toBe('failed');
	});

	it('mirrors the context statechange event into status', async () => {
		const fakeContext = createFakeAudioContext();
		const controller = createAudioContextController({
			contextFactory: () => asBaseAudioContext(fakeContext)
		});

		await controller.initialize();
		expect(controller.status).toBe('running');

		fakeContext.setState('suspended');
		expect(controller.status).toBe('suspended');
	});

	it('onStatusChange returns a working unsubscribe function', async () => {
		const fakeContext = createFakeAudioContext();
		const controller = createAudioContextController({
			contextFactory: () => asBaseAudioContext(fakeContext)
		});
		const statuses: AudioContextStatus[] = [];
		const unsubscribe = controller.onStatusChange((status) => statuses.push(status));

		await controller.initialize();
		expect(statuses.length).toBeGreaterThan(0);

		unsubscribe();
		statuses.length = 0;
		fakeContext.setState('suspended');
		expect(statuses).toEqual([]);
	});

	it('close() sets status closed and clears listeners', async () => {
		const fakeContext = createFakeAudioContext();
		const controller = createAudioContextController({
			contextFactory: () => asBaseAudioContext(fakeContext)
		});
		await controller.initialize();

		const statuses: AudioContextStatus[] = [];
		controller.onStatusChange((status) => statuses.push(status));

		await controller.close();

		expect(controller.status).toBe('closed');
		expect(statuses).toContain('closed');

		statuses.length = 0;
		fakeContext.setState('running'); // stray event after close; no listener should remain
		expect(statuses).toEqual([]);
	});
});
