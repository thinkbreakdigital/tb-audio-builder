import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUDIO_LIMITS } from '../src/constants.js';
import { createAudioEngine } from '../src/engine/audio-engine.js';
import type { AudioEngine } from '../src/engine/audio-engine.js';
import { buildEventTimeline } from '../src/engine/event-timeline.js';
import { createTempoMap } from '../src/engine/tempo-map.js';
import { createTransport } from '../src/engine/transport.js';
import type { Transport } from '../src/engine/transport.js';
import { createVoiceManager } from '../src/engine/voice-manager.js';
import type { VoiceManager } from '../src/engine/voice-manager.js';
import { PlaybackError } from '../src/errors.js';
import { createSilentVoiceFactory } from '../src/synth/silent-voice.js';
import type { SilentVoice } from '../src/synth/silent-voice.js';
import { createVoiceFactoryRegistry } from '../src/synth/voice.js';
import { buildSong, makePitchedInstrument, notesEvery } from './fakes/build-song.js';
import type { BuildSongInput, BuiltProject } from './fakes/build-song.js';
import {
	asAudioNode,
	asBaseAudioContext,
	asFakeGainNode,
	createFakeAudioContext
} from './fakes/fake-audio-context.js';
import type { FakeAudioContext, FakeAudioNode } from './fakes/fake-audio-context.js';

/** At 480 PPQ and 120 BPM, 960 ticks is one second. */
const TICKS_PER_SECOND = 960;

/** Walks the context clock and the interval timer forward together. */
function runFor(fake: FakeAudioContext, seconds: number, stepMs = 25): void {
	const steps = Math.round((seconds * 1000) / stepMs);
	for (let step = 0; step < steps; step += 1) {
		fake.advanceTimeBy(stepMs / 1000);
		vi.advanceTimersByTime(stepMs);
	}
}

function countLiveNodes(fake: FakeAudioContext): number {
	// `destination` is never disconnected; every other node the engine builds must be.
	return fake.createdNodes.filter((node) => !node.disposed && node.nodeKind !== 'destination')
		.length;
}

interface TransportHarness {
	fake: FakeAudioContext;
	transport: Transport;
	voiceManager: VoiceManager;
	voices: readonly SilentVoice[];
	dispatched: Array<{ tick: number; startAtSeconds: number }>;
}

function setupTransport(song: BuildSongInput): TransportHarness {
	const fake = createFakeAudioContext();
	const context = asBaseAudioContext(fake);
	const built = buildSong(song);
	const tempoMap = createTempoMap({
		tempoChanges: built.song.tempoChanges,
		ticksPerQuarterNote: built.song.ticksPerQuarterNote,
		durationTicks: built.song.durationTicks
	});
	const timeline = buildEventTimeline({ song: built.song, channels: built.channels });

	const pitched = createSilentVoiceFactory('pitched');
	const registry = createVoiceFactoryRegistry();
	registry.register(pitched.factory);
	const voiceManager = createVoiceManager({
		registry,
		limits: {
			maxTotalVoices: DEFAULT_AUDIO_LIMITS.maxTotalVoices,
			maxVoicesPerChannel: DEFAULT_AUDIO_LIMITS.maxVoicesPerChannel
		}
	});

	const destination = asAudioNode(fake.createGain());
	const instrument = makePitchedInstrument();
	const dispatched: Array<{ tick: number; startAtSeconds: number }> = [];

	const transport = createTransport({
		context,
		tempoMap,
		timeline,
		voiceManager,
		dispatch: (event, startAtSeconds, releaseAtSeconds) => {
			dispatched.push({ tick: event.tick, startAtSeconds });
			voiceManager.start(
				{
					channelId: event.channelId,
					instrument,
					midiNote: event.midiNote,
					velocity: event.velocity,
					startAtSeconds,
					releaseAtSeconds,
					destination,
					context,
					sequence: event.sequence
				},
				'normal'
			);
		}
	});

	return { fake, transport, voiceManager, voices: pitched.createdVoices, dispatched };
}

interface EngineHarness {
	fake: FakeAudioContext;
	engine: AudioEngine;
	pitchedVoices: readonly SilentVoice[];
}

function setupEngine(): EngineHarness {
	const fake = createFakeAudioContext();
	const pitched = createSilentVoiceFactory('pitched');
	const percussion = createSilentVoiceFactory('percussion');
	const engine = createAudioEngine({
		contextFactory: () => asBaseAudioContext(fake),
		voiceFactories: [pitched.factory, percussion.factory]
	});
	return { fake, engine, pitchedVoices: pitched.createdVoices };
}

/** Four pitched tracks, eight notes each, one note every half second. */
function buildFourTrackFixture(): BuiltProject {
	return buildSong({
		channels: [1, 2, 3, 4].map((index) => ({
			id: `ch-${index}`,
			notes: notesEvery({ count: 8, stepTicks: 480, midiNote: 48 + index })
		}))
	});
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('createTransport', () => {
	it('moves through stopped, playing, paused, and back', () => {
		const { transport, fake } = setupTransport({
			channels: [{ notes: notesEvery({ count: 8, stepTicks: 480 }) }]
		});

		expect(transport.status).toBe('stopped');
		transport.play();
		expect(transport.status).toBe('playing');
		runFor(fake, 0.5);
		transport.pause();
		expect(transport.status).toBe('paused');
		transport.play();
		expect(transport.status).toBe('playing');
		transport.stop();
		expect(transport.status).toBe('stopped');
	});

	it('resumes at the paused tick', () => {
		const { transport, fake } = setupTransport({
			channels: [{ notes: notesEvery({ count: 8, stepTicks: 480 }) }]
		});

		transport.play();
		runFor(fake, 1);
		transport.pause();
		expect(transport.positionTicks).toBeCloseTo(TICKS_PER_SECOND, 6);

		// Context time keeps running while paused; the stored position must not.
		fake.advanceTimeBy(2);
		expect(transport.positionTicks).toBeCloseTo(TICKS_PER_SECOND, 6);

		transport.play();
		expect(Math.abs(transport.positionTicks - TICKS_PER_SECOND)).toBeLessThanOrEqual(1);
	});

	it('stop resets the position to 0 and hard-stops every voice', () => {
		const harness = setupTransport({
			channels: [{ notes: notesEvery({ count: 8, stepTicks: 480 }) }]
		});

		harness.transport.play();
		runFor(harness.fake, 1);
		expect(harness.voiceManager.activeVoiceCount).toBeGreaterThan(0);

		harness.transport.stop();

		expect(harness.transport.positionTicks).toBe(0);
		expect(harness.voiceManager.activeVoiceCount).toBe(0);
		expect(harness.voices.every((voice) => voice.stoppedAtSeconds !== null)).toBe(true);
	});

	it('starts playback at a seeked tick', () => {
		const harness = setupTransport({
			channels: [{ notes: notesEvery({ count: 8, stepTicks: 480 }) }]
		});

		harness.transport.seekToTick(1920);
		expect(harness.transport.positionTicks).toBe(1920);

		harness.transport.play();
		expect(harness.transport.positionTicks).toBeCloseTo(1920, 6);

		runFor(harness.fake, 0.6);
		expect(harness.dispatched[0]?.tick).toBe(1920);
		expect(harness.dispatched.every((note) => note.tick >= 1920)).toBe(true);
	});

	it('clamps a seek past the end of the song', () => {
		const { transport } = setupTransport({
			channels: [{ notes: notesEvery({ count: 8, stepTicks: 480 }) }]
		});

		transport.seekToTick(999_999);
		expect(transport.positionTicks).toBe(transport.durationTicks);

		transport.seekToTick(-500);
		expect(transport.positionTicks).toBe(0);
	});

	it('setTempoMultiplier mid-playback keeps the position and halves note spacing', () => {
		const harness = setupTransport({
			channels: [{ notes: notesEvery({ count: 8, stepTicks: 480 }) }]
		});

		harness.transport.play();
		runFor(harness.fake, 1);
		const positionBefore = harness.transport.positionTicks;

		harness.transport.setTempoMultiplier(2);

		expect(harness.transport.positionTicks).toBeCloseTo(positionBefore, 6);

		runFor(harness.fake, 1.5);
		const afterChange = harness.dispatched.filter((note) => note.tick >= 1440);
		expect(afterChange.length).toBeGreaterThanOrEqual(3);
		for (let index = 1; index < afterChange.length; index += 1) {
			const previous = afterChange[index - 1] as { startAtSeconds: number };
			const current = afterChange[index] as { startAtSeconds: number };
			expect(current.startAtSeconds - previous.startAtSeconds).toBeCloseTo(0.25, 6);
		}
	});

	it('clamps the tempo multiplier to its documented range', () => {
		const harness = setupTransport({
			channels: [{ notes: notesEvery({ count: 4, stepTicks: 480 }) }]
		});

		harness.transport.setTempoMultiplier(100);
		harness.transport.play();
		runFor(harness.fake, 0.1);

		// Clamped to 4x: the note at tick 480 (0.5 song seconds) lands at 0.125 context seconds.
		const second = harness.dispatched.find((note) => note.tick === 480);
		expect(second?.startAtSeconds).toBeCloseTo(0.125, 6);
	});

	it('rejects a loop region that does not advance or runs past the song', () => {
		const { transport } = setupTransport({
			channels: [{ notes: notesEvery({ count: 8, stepTicks: 480 }) }]
		});

		expect(() => transport.setLoop({ enabled: true, startTick: 960, endTick: 960 })).toThrow(
			PlaybackError
		);
		expect(() => transport.setLoop({ enabled: true, startTick: 1920, endTick: 960 })).toThrow(
			/region \[1920, 960\) is invalid/
		);
		expect(() =>
			transport.setLoop({ enabled: true, startTick: 0, endTick: transport.durationTicks + 1 })
		).toThrow(PlaybackError);
	});

	it('keeps the audible position in the current pass when look-ahead schedules a future loop wrap', () => {
		const harness = setupTransport({
			durationTicks: 7680,
			channels: [{ notes: notesEvery({ count: 8, stepTicks: 960 }) }]
		});
		harness.transport.setLoop({ enabled: true, startTick: 0, endTick: 7680 });
		harness.transport.play();

		// The 100ms window now crosses the 8s boundary, while the audible clock is still at 7.925s.
		runFor(harness.fake, 7.925);
		expect(harness.transport.positionTicks).toBeGreaterThan(7500);
		expect(harness.transport.positionTicks).toBeLessThan(7680);

		harness.transport.pause();
		const pausedTick = harness.transport.positionTicks;
		harness.transport.play();
		expect(harness.transport.positionTicks).toBeCloseTo(pausedTick, 6);
	});

	it('stops its interval at natural completion, holds the end position, and restarts at zero', () => {
		const harness = setupTransport({
			durationTicks: 960,
			channels: [{ notes: [{ tick: 0, durationTicks: 960 }] }]
		});
		harness.transport.play();
		runFor(harness.fake, 1.1);

		expect(harness.transport.status).toBe('stopped');
		expect(harness.transport.positionTicks).toBe(960);
		expect(vi.getTimerCount()).toBe(0);

		harness.transport.play();
		expect(harness.transport.status).toBe('playing');
		expect(harness.transport.positionTicks).toBeCloseTo(0, 6);
	});

	it('reports an interval scheduling error and stops the failing scheduler', () => {
		const fake = createFakeAudioContext();
		const built = buildSong({
			durationTicks: 1,
			channels: [{ notes: [{ tick: 0, durationTicks: 1 }] }]
		});
		const tempoMap = createTempoMap({
			tempoChanges: built.song.tempoChanges,
			ticksPerQuarterNote: built.song.ticksPerQuarterNote,
			durationTicks: built.song.durationTicks
		});
		const timeline = buildEventTimeline({ song: built.song, channels: built.channels });
		const pitched = createSilentVoiceFactory('pitched');
		const registry = createVoiceFactoryRegistry();
		registry.register(pitched.factory);
		const voiceManager = createVoiceManager({
			registry,
			limits: { maxTotalVoices: 32, maxVoicesPerChannel: 8 }
		});
		let reported: PlaybackError | null = null;
		const transport = createTransport({
			context: asBaseAudioContext(fake),
			tempoMap,
			timeline,
			voiceManager,
			dispatch: () => undefined,
			onError: (error) => {
				reported = error;
			}
		});
		transport.setLoop({ enabled: true, startTick: 0, endTick: 1 });
		transport.play();

		expect(reported).toBeInstanceOf(PlaybackError);
		expect(transport.status).toBe('paused');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('dispose leaves no interval running and refuses further calls', () => {
		const { transport, fake } = setupTransport({
			channels: [{ notes: notesEvery({ count: 8, stepTicks: 480 }) }]
		});

		transport.play();
		runFor(fake, 0.1);
		expect(vi.getTimerCount()).toBe(1);

		transport.dispose();

		expect(vi.getTimerCount()).toBe(0);
		expect(() => transport.play()).toThrow(PlaybackError);
		expect(() => transport.dispose()).not.toThrow();
	});
});

describe('createAudioEngine', () => {
	it('plays a 4-track fixture, dispatching every note exactly once at the right time', async () => {
		const harness = setupEngine();
		const built = buildFourTrackFixture();
		harness.engine.loadProject(built);
		await harness.engine.initialize();

		harness.engine.play();
		runFor(harness.fake, 4.2);

		expect(harness.pitchedVoices).toHaveLength(32);

		const expected = new Set<string>();
		for (const channel of built.channels) {
			for (let index = 0; index < 8; index += 1) {
				expected.add(`${channel.id}@${(index * 0.5).toFixed(6)}`);
			}
		}
		const actual = new Set(
			harness.pitchedVoices.map(
				(voice) => `${voice.channelId}@${voice.startedAtSeconds.toFixed(6)}`
			)
		);
		expect(actual).toEqual(expected);
	});

	it('produces exactly ten times the region note count over a 10-pass loop', async () => {
		const harness = setupEngine();
		const regionTicks = 7680; // 4 bars = 8 seconds
		harness.engine.loadProject(
			buildSong({
				durationTicks: regionTicks,
				loop: { enabled: true, startTick: 0, endTick: regionTicks },
				channels: [{ notes: notesEvery({ count: 8, stepTicks: 960 }) }]
			})
		);
		await harness.engine.initialize();

		harness.engine.play();
		// Ten 8-second passes, stopping a look-ahead short of pass 11's first note.
		runFor(harness.fake, 79.8);

		expect(harness.pitchedVoices).toHaveLength(80);
	});

	it('stop() leaves activeVoiceCount at 0', async () => {
		const harness = setupEngine();
		harness.engine.loadProject(buildFourTrackFixture());
		await harness.engine.initialize();

		harness.engine.play();
		runFor(harness.fake, 1);
		expect(harness.engine.activeVoiceCount).toBeGreaterThan(0);

		harness.engine.stop();

		expect(harness.engine.activeVoiceCount).toBe(0);
		expect(harness.engine.positionTicks).toBe(0);
		expect(harness.engine.status).toBe('stopped');
	});

	it('loadProject 50 times leaves one interval, no voices, and no accumulated nodes', async () => {
		const harness = setupEngine();
		harness.engine.loadProject(buildFourTrackFixture());
		await harness.engine.initialize();
		// master gain/compressor/analyser plus gain/panner/analyser for each of the four channels.
		const liveNodesAfterFirstLoad = countLiveNodes(harness.fake);
		expect(liveNodesAfterFirstLoad).toBe(15);

		for (let iteration = 0; iteration < 50; iteration += 1) {
			harness.engine.loadProject(buildFourTrackFixture());
			harness.engine.play();
			runFor(harness.fake, 0.1);
		}

		expect(vi.getTimerCount()).toBe(1);
		expect(countLiveNodes(harness.fake)).toBe(liveNodesAfterFirstLoad);

		harness.engine.stop();

		expect(harness.engine.activeVoiceCount).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('throws a contextual PlaybackError when play() is called before initialize()', () => {
		const harness = setupEngine();
		harness.engine.loadProject(buildFourTrackFixture());

		expect(() => harness.engine.play()).toThrow(PlaybackError);
		expect(() => harness.engine.play()).toThrow(/before initialize\(\)/);
	});

	it('applies a project loaded before initialization', async () => {
		const harness = setupEngine();
		harness.engine.loadProject(buildFourTrackFixture());

		// Durations come from the pure tempo map, so they read correctly with no context yet.
		expect(harness.engine.durationTicks).toBe(3840);
		expect(harness.engine.durationSeconds).toBeCloseTo(4, 9);

		await harness.engine.initialize();
		harness.engine.play();
		runFor(harness.fake, 0.1);

		expect(harness.engine.status).toBe('playing');
		expect(harness.pitchedVoices.length).toBeGreaterThan(0);
	});

	it('solo silences other channels on the bus without skipping their dispatch', async () => {
		const harness = setupEngine();
		harness.engine.loadProject(buildFourTrackFixture());
		await harness.engine.initialize();

		harness.engine.setChannelSoloed('ch-1', true);

		// Gain nodes in creation order: master, then one per channel bus.
		const gains = harness.fake.createdNodes.filter((node) => node.nodeKind === 'gain');
		expect(asFakeGainNode(gains[1] as FakeAudioNode).gain.value).toBeCloseTo(0.8, 9);
		expect(asFakeGainNode(gains[2] as FakeAudioNode).gain.value).toBe(0);

		harness.engine.play();
		runFor(harness.fake, 0.1);

		// Mute and solo are gain-only, so an inaudible channel still starts its voices and becomes
		// audible instantly when un-soloed mid-note.
		expect(harness.pitchedVoices.some((voice) => voice.channelId === 'ch-2')).toBe(true);
	});

	it('skips dispatch for a disabled channel so it burns no voice', async () => {
		const harness = setupEngine();
		harness.engine.loadProject(buildFourTrackFixture());
		await harness.engine.initialize();

		harness.engine.setChannelEnabled('ch-2', false);
		harness.engine.play();
		runFor(harness.fake, 1);

		expect(harness.pitchedVoices.some((voice) => voice.channelId === 'ch-1')).toBe(true);
		expect(harness.pitchedVoices.some((voice) => voice.channelId === 'ch-2')).toBe(false);
	});

	it('names the offending channel when one is unknown', async () => {
		const harness = setupEngine();
		harness.engine.loadProject(buildFourTrackFixture());
		await harness.engine.initialize();

		expect(() => harness.engine.setChannelVolume('ch-nope', 0.5)).toThrow(
			/no channel "ch-nope" in the loaded project/
		);
	});

	it('dispose is safe twice and every later call throws', async () => {
		const harness = setupEngine();
		harness.engine.loadProject(buildFourTrackFixture());
		await harness.engine.initialize();
		harness.engine.play();
		runFor(harness.fake, 0.1);

		harness.engine.dispose();

		expect(vi.getTimerCount()).toBe(0);
		expect(countLiveNodes(harness.fake)).toBe(0);
		expect(() => harness.engine.dispose()).not.toThrow();
		expect(() => harness.engine.play()).toThrow(PlaybackError);
		expect(() => harness.engine.stop()).toThrow(/after dispose\(\)/);
	});

	it('triggerPreview starts one voice just ahead of now with a one-second release', async () => {
		const harness = setupEngine();
		harness.engine.loadProject(buildFourTrackFixture());
		await harness.engine.initialize();
		harness.fake.advanceTimeTo(3);

		harness.engine.triggerPreview('ch-1', 64, 0.9);

		expect(harness.pitchedVoices).toHaveLength(1);
		const voice = harness.pitchedVoices[0] as SilentVoice;
		expect(voice.startedAtSeconds).toBeCloseTo(3.005, 9);
		expect(voice.request.releaseAtSeconds).toBeCloseTo(4.005, 9);
	});

	it('beginPreview holds a pitched voice until the returned handle releases it', async () => {
		const harness = setupEngine();
		harness.engine.loadProject(buildFourTrackFixture());
		await harness.engine.initialize();
		const handle = harness.engine.beginPreview('ch-1', 64, 0.9);
		expect(handle).not.toBeNull();
		expect(harness.pitchedVoices[0]?.request.releaseAtSeconds).toBe(Infinity);

		harness.fake.advanceTimeTo(0.5);
		handle?.release();
		expect(harness.pitchedVoices[0]?.releasedAtSeconds).toBe(0.5);
	});

	it('repeated initialize and suspended-context recovery reuse the existing graph', async () => {
		const harness = setupEngine();
		harness.engine.loadProject(buildFourTrackFixture());
		await harness.engine.initialize();
		const createdNodeCount = harness.fake.createdNodes.length;

		await harness.engine.initialize();
		expect(harness.fake.createdNodes).toHaveLength(createdNodeCount);
		harness.fake.setState('suspended');
		expect(harness.engine.audioContextStatus).toBe('suspended');
		await harness.engine.resumeAudioContext();
		expect(harness.engine.audioContextStatus).toBe('running');
		expect(harness.fake.createdNodes).toHaveLength(createdNodeCount);
	});
});
