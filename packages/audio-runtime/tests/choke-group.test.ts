import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUDIO_LIMITS } from '../src/constants.js';
import { createAudioEngine } from '../src/engine/audio-engine.js';
import { createVoiceManager } from '../src/engine/voice-manager.js';
import { getPercussionPreset } from '../src/presets/percussion-presets.js';
import { resolveChokeGroup } from '../src/synth/percussion-voice.js';
import { createSilentVoiceFactory } from '../src/synth/silent-voice.js';
import type { SilentVoice } from '../src/synth/silent-voice.js';
import { createVoiceFactoryRegistry } from '../src/synth/voice.js';
import type { VoiceStartRequest } from '../src/synth/voice.js';
import type { PercussionInstrumentDefinition } from '../src/types/instrument.js';
import { buildSong, makePercussionInstrument, makePitchedInstrument } from './fakes/build-song.js';
import {
	asAudioNode,
	asBaseAudioContext,
	asFakeGainNode,
	createFakeAudioContext
} from './fakes/fake-audio-context.js';
import type { FakeAudioContext } from './fakes/fake-audio-context.js';

function setupManager(): {
	manager: ReturnType<typeof createVoiceManager>;
	voices: readonly SilentVoice[];
	fake: FakeAudioContext;
} {
	const registry = createVoiceFactoryRegistry();
	const percussion = createSilentVoiceFactory('percussion');
	const pitched = createSilentVoiceFactory('pitched');
	registry.register(percussion.factory);
	registry.register(pitched.factory);

	return {
		manager: createVoiceManager({
			registry,
			limits: {
				maxTotalVoices: DEFAULT_AUDIO_LIMITS.maxTotalVoices,
				maxVoicesPerChannel: DEFAULT_AUDIO_LIMITS.maxVoicesPerChannel
			}
		}),
		voices: percussion.createdVoices,
		fake: createFakeAudioContext()
	};
}

function makeRequest(input: {
	fake: FakeAudioContext;
	channelId: string;
	instrument: VoiceStartRequest['instrument'];
	startAtSeconds: number;
}): VoiceStartRequest {
	return {
		channelId: input.channelId,
		instrument: input.instrument,
		midiNote: 36,
		velocity: 0.8,
		startAtSeconds: input.startAtSeconds,
		releaseAtSeconds: Infinity,
		destination: asAudioNode(input.fake.createGain()),
		context: asBaseAudioContext(input.fake)
	};
}

describe('resolveChokeGroup', () => {
	it('reports the trimmed group for percussion and nothing for anything else', () => {
		expect(resolveChokeGroup(makePercussionInstrument(' hats '))).toBe('hats');
		expect(resolveChokeGroup(makePercussionInstrument(null))).toBeNull();
		// An empty group is normalized away at the schema boundary; a hand-built one must not become
		// a real group that chokes every other ungrouped hit.
		expect(resolveChokeGroup(makePercussionInstrument('   '))).toBeNull();
		expect(resolveChokeGroup(makePitchedInstrument())).toBeNull();
	});
});

describe('VoiceManager.stopChokeGroup', () => {
	it('stops only the voices already sounding in that group', () => {
		const { manager, voices, fake } = setupManager();
		const hats = makePercussionInstrument('hats');
		const cymbals = makePercussionInstrument('cymbals');
		const ungrouped = makePercussionInstrument(null);
		manager.start(
			makeRequest({ fake, channelId: 'open', instrument: hats, startAtSeconds: 0.5 }),
			'normal'
		);
		manager.start(
			makeRequest({ fake, channelId: 'crash', instrument: cymbals, startAtSeconds: 0.5 }),
			'normal'
		);
		manager.start(
			makeRequest({ fake, channelId: 'kick', instrument: ungrouped, startAtSeconds: 0.5 }),
			'normal'
		);

		manager.stopChokeGroup('hats', 1);

		const [openHat, crash, kick] = voices;
		expect(openHat?.stoppedAtSeconds).toBe(1);
		expect(crash?.stoppedAtSeconds).toBeNull();
		expect(kick?.stoppedAtSeconds).toBeNull();
		expect(manager.activeVoiceCount).toBe(2);
	});

	it('leaves a voice scheduled to start at or after the choke alone', () => {
		const { manager, voices, fake } = setupManager();
		const hats = makePercussionInstrument('hats');
		manager.start(
			makeRequest({ fake, channelId: 'a', instrument: hats, startAtSeconds: 1 }),
			'normal'
		);
		manager.start(
			makeRequest({ fake, channelId: 'b', instrument: hats, startAtSeconds: 1.5 }),
			'normal'
		);

		manager.stopChokeGroup('hats', 1);

		expect(voices[0]?.stoppedAtSeconds).toBeNull();
		expect(voices[1]?.stoppedAtSeconds).toBeNull();
		expect(manager.activeVoiceCount).toBe(2);
	});

	it('chokes nothing when the group is null', () => {
		const { manager, voices, fake } = setupManager();
		manager.start(
			makeRequest({
				fake,
				channelId: 'kick',
				instrument: makePercussionInstrument(null),
				startAtSeconds: 0
			}),
			'normal'
		);

		manager.stopChokeGroup('hats', 1);

		expect(voices[0]?.stoppedAtSeconds).toBeNull();
		expect(manager.activeVoiceCount).toBe(1);
	});

	it('cuts rather than fades — choking uses stop(), never release()', () => {
		const { manager, voices, fake } = setupManager();
		manager.start(
			makeRequest({
				fake,
				channelId: 'open',
				instrument: makePercussionInstrument('hats'),
				startAtSeconds: 0.5
			}),
			'normal'
		);

		manager.stopChokeGroup('hats', 1);

		expect(voices[0]?.stoppedAtSeconds).toBe(1);
		expect(voices[0]?.releasedAtSeconds).toBeNull();
	});
});

/** Walks the context clock and the interval timer forward together. */
function runFor(fake: FakeAudioContext, seconds: number, stepMs = 25): void {
	const steps = Math.round((seconds * 1000) / stepMs);
	for (let step = 0; step < steps; step += 1) {
		fake.advanceTimeBy(stepMs / 1000);
		vi.advanceTimersByTime(stepMs);
	}
}

function hatChannels(input: {
	openStartTick: number;
	closedStartTick: number;
	chokeGroup?: string | null;
}): ReturnType<typeof buildSong> {
	const withGroup = (id: string): PercussionInstrumentDefinition => {
		const definition = getPercussionPreset(id).definition;
		if (definition.kind !== 'percussion') throw new Error(`Preset "${id}" is not percussion.`);
		return input.chokeGroup === undefined
			? definition
			: { ...definition, chokeGroup: input.chokeGroup };
	};

	return buildSong({
		channels: [
			{
				id: 'open',
				role: 'percussion',
				instrument: withGroup('open-hat'),
				notes: [{ tick: input.openStartTick, durationTicks: 120, midiNote: 46 }]
			},
			{
				id: 'closed',
				role: 'percussion',
				instrument: withGroup('closed-hat'),
				notes: [{ tick: input.closedStartTick, durationTicks: 120, midiNote: 42 }]
			}
		],
		durationTicks: 3840
	});
}

describe('choke groups through the audio engine', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('cuts a ringing open hi-hat at the exact moment a closed hi-hat starts', async () => {
		const fake = createFakeAudioContext();
		const percussion = createSilentVoiceFactory('percussion');
		const engine = createAudioEngine({
			contextFactory: () => asBaseAudioContext(fake),
			voiceFactories: [percussion.factory]
		});
		// 480 PPQ at 120 BPM: the open hat starts 0.5s before the closed one.
		engine.loadProject(hatChannels({ openStartTick: 480, closedStartTick: 960 }));
		await engine.initialize();

		engine.play();
		runFor(fake, 2);

		const [openHat, closedHat] = percussion.createdVoices;
		expect(percussion.createdVoices).toHaveLength(2);
		expect(closedHat?.startedAtSeconds).toBeCloseTo((openHat?.startedAtSeconds as number) + 0.5, 9);
		// Cut exactly on the new hit, and cut rather than faded.
		expect(openHat?.stoppedAtSeconds).toBe(closedHat?.startedAtSeconds);
		expect(openHat?.releasedAtSeconds).toBeNull();
		// The hit doing the choking is never choked by its own group.
		expect(closedHat?.stoppedAtSeconds).toBeNull();

		engine.dispose();
	});

	it('leaves both hats alone once they are out of each other group', async () => {
		const fake = createFakeAudioContext();
		const percussion = createSilentVoiceFactory('percussion');
		const engine = createAudioEngine({
			contextFactory: () => asBaseAudioContext(fake),
			voiceFactories: [percussion.factory]
		});
		engine.loadProject(hatChannels({ openStartTick: 480, closedStartTick: 960, chokeGroup: null }));
		await engine.initialize();

		engine.play();
		runFor(fake, 2);

		expect(percussion.createdVoices).toHaveLength(2);
		expect(percussion.createdVoices.every((voice) => voice.stoppedAtSeconds === null)).toBe(true);

		engine.dispose();
	});

	it('ramps the real voice down instead of dropping it mid-cycle', async () => {
		const fake = createFakeAudioContext();
		const engine = createAudioEngine({ contextFactory: () => asBaseAudioContext(fake) });
		engine.loadProject(hatChannels({ openStartTick: 480, closedStartTick: 960 }));
		await engine.initialize();
		const nodesBefore = fake.createdNodes.length;

		engine.play();
		runFor(fake, 2);

		// The open hat is the first voice built in this run, so its four gains lead. A layer gain is
		// the one that opens with a plain `setValueAtTime`; an envelope gain opens by cancelling.
		const layerGains = fake.createdNodes
			.slice(nodesBefore)
			.filter((node) => node.nodeKind === 'gain')
			.map(asFakeGainNode)
			.slice(0, 4)
			.filter((gain) => gain.gain.automation[0]?.method === 'setValueAtTime');

		expect(layerGains).toHaveLength(2);
		const chokeRampTimes = layerGains.map((gain) => {
			// The layer gain, constant until the choke: one setValueAtTime, then cancel/hold/ramp.
			const automation = gain.gain.automation;
			expect(automation.map((call) => call.method)).toEqual([
				'setValueAtTime',
				'cancelScheduledValues',
				'setValueAtTime',
				'linearRampToValueAtTime'
			]);
			expect(automation[3]?.value).toBe(0);
			return automation[3]?.atSeconds;
		});
		// Both layers of the choked hit fall silent together, over one 5ms ramp.
		expect(chokeRampTimes[0]).toBe(chokeRampTimes[1]);

		engine.dispose();
	});

	it('chokes what is already sounding when a hit is previewed', async () => {
		const fake = createFakeAudioContext();
		const percussion = createSilentVoiceFactory('percussion');
		const engine = createAudioEngine({
			contextFactory: () => asBaseAudioContext(fake),
			voiceFactories: [percussion.factory]
		});
		engine.loadProject(hatChannels({ openStartTick: 480, closedStartTick: 3360 }));
		await engine.initialize();

		engine.play();
		runFor(fake, 1);
		expect(percussion.createdVoices).toHaveLength(1);

		engine.triggerPreview('closed', 42, 0.9);

		const [openHat, preview] = percussion.createdVoices;
		expect(openHat?.stoppedAtSeconds).toBe(preview?.startedAtSeconds);

		engine.dispose();
	});
});
