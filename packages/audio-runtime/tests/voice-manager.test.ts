import { describe, expect, it } from 'vitest';
import { createVoiceManager } from '../src/engine/voice-manager.js';
import type { VoiceManager, VoiceManagerLimits } from '../src/engine/voice-manager.js';
import { createVoiceFactoryRegistry } from '../src/synth/voice.js';
import type { VoiceStartRequest } from '../src/synth/voice.js';
import { createSilentVoiceFactory } from '../src/synth/silent-voice.js';
import type { SilentVoice } from '../src/synth/silent-voice.js';
import type {
	InstrumentDefinition,
	PercussionInstrumentDefinition,
	PitchedInstrumentDefinition
} from '../src/types/instrument.js';

// Silent voices never touch the audio graph, so `VoiceStartRequest.destination`/`.context` only
// need to satisfy the type — these casts document that the stubs are intentionally incomplete.
const stubDestination = {} as AudioNode;
const stubContext = {} as BaseAudioContext;

function makePitchedInstrument(overrides?: {
	polyphonic?: boolean;
	maxVoices?: number;
}): PitchedInstrumentDefinition {
	return {
		kind: 'pitched',
		presetId: null,
		oscillator: { waveform: 'sine', octaveOffset: 0, semitoneOffset: 0, fineDetuneCents: 0 },
		amplitudeEnvelope: {
			attackSeconds: 0.01,
			decaySeconds: 0.1,
			sustainLevel: 0.8,
			releaseSeconds: 0.2
		},
		filter: { enabled: false, type: 'lowpass', frequencyHz: 20000, q: 1 },
		modulation: {
			vibratoEnabled: false,
			vibratoRateHz: 5,
			vibratoDepthCents: 0,
			pitchBendRangeSemitones: 2
		},
		voice: {
			polyphonic: overrides?.polyphonic ?? true,
			maxVoices: overrides?.maxVoices ?? 8,
			stealMode: 'oldest'
		}
	};
}

function makePercussionInstrument(chokeGroup: string | null): PercussionInstrumentDefinition {
	return {
		kind: 'percussion',
		presetId: null,
		oscillatorLayer: {
			enabled: true,
			waveform: 'sine',
			startFrequencyHz: 200,
			endFrequencyHz: 60,
			pitchDecaySeconds: 0.05,
			attackSeconds: 0,
			decaySeconds: 0.1,
			sustainLevel: 0,
			releaseSeconds: 0.05,
			gain: 1
		},
		noiseLayer: {
			enabled: false,
			filterType: 'highpass',
			filterFrequencyHz: 2000,
			filterQ: 1,
			attackSeconds: 0,
			decaySeconds: 0.05,
			sustainLevel: 0,
			releaseSeconds: 0.05,
			gain: 0
		},
		chokeGroup
	};
}

function makeRequest(input: {
	channelId: string;
	instrument: InstrumentDefinition;
	startAtSeconds: number;
	sequence?: number;
	midiNote?: number;
}): VoiceStartRequest {
	return {
		channelId: input.channelId,
		instrument: input.instrument,
		midiNote: input.midiNote ?? 60,
		velocity: 0.8,
		startAtSeconds: input.startAtSeconds,
		releaseAtSeconds: input.startAtSeconds + 1,
		destination: stubDestination,
		context: stubContext,
		sequence: input.sequence
	};
}

function setupManager(options?: {
	limits?: Partial<VoiceManagerLimits>;
	maxVoicesPerChannelOverride?: (channelId: string) => number | undefined;
}): {
	manager: VoiceManager;
	pitchedVoices: readonly SilentVoice[];
	percussionVoices: readonly SilentVoice[];
} {
	const pitched = createSilentVoiceFactory('pitched');
	const percussion = createSilentVoiceFactory('percussion');
	const registry = createVoiceFactoryRegistry();
	registry.register(pitched.factory);
	registry.register(percussion.factory);

	const manager = createVoiceManager({
		registry,
		limits: {
			maxTotalVoices: options?.limits?.maxTotalVoices ?? 32,
			maxVoicesPerChannel: options?.limits?.maxVoicesPerChannel ?? 8
		},
		maxVoicesPerChannelOverride: options?.maxVoicesPerChannelOverride
	});

	return {
		manager,
		pitchedVoices: pitched.createdVoices,
		percussionVoices: percussion.createdVoices
	};
}

/** Deterministic per-seed shuffle (no `Math.random`) so the 100-run tie-break test is reproducible. */
function seededShuffle<T>(items: readonly T[], seed: number): T[] {
	const result = [...items];
	let state = seed + 1;
	const nextRandom = (): number => {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		return state / 0x7fffffff;
	};
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(nextRandom() * (i + 1));
		const swap = result[i] as T;
		result[i] = result[j] as T;
		result[j] = swap;
	}
	return result;
}

describe('createVoiceManager', () => {
	it('releases the oldest voice on a channel when the per-channel limit is reached', () => {
		const { manager, pitchedVoices } = setupManager({ maxVoicesPerChannelOverride: () => 2 });
		const instrument = makePitchedInstrument();

		const first = manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 0, sequence: 0 }),
			'normal'
		);
		const second = manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 1, sequence: 1 }),
			'normal'
		);
		const third = manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 2, sequence: 2 }),
			'normal'
		);

		expect(first).not.toBeNull();
		expect(second).not.toBeNull();
		expect(third).not.toBeNull();
		expect(pitchedVoices[0]?.isReleasing).toBe(true);
		expect(pitchedVoices[0]?.releasedAtSeconds).toBe(2);
		expect(pitchedVoices[1]?.isReleasing).toBe(false);
		expect(manager.activeVoiceCount).toBe(2);
	});

	it('prefers stealing a low-priority voice anywhere when the global limit is reached', () => {
		const { manager, pitchedVoices } = setupManager({ limits: { maxTotalVoices: 2 } });
		const instrument = makePitchedInstrument();

		const low = manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 0, sequence: 0 }),
			'low'
		);
		const normal = manager.start(
			makeRequest({ channelId: 'ch-2', instrument, startAtSeconds: 1, sequence: 1 }),
			'normal'
		);
		const incoming = manager.start(
			makeRequest({ channelId: 'ch-3', instrument, startAtSeconds: 2, sequence: 2 }),
			'normal'
		);

		expect(low).not.toBeNull();
		expect(normal).not.toBeNull();
		expect(incoming).not.toBeNull();
		expect(pitchedVoices[0]?.isReleasing).toBe(true);
		expect(pitchedVoices[1]?.isReleasing).toBe(false);
		expect(manager.activeVoiceCount).toBe(2);
	});

	it('breaks ties on identical startedAtSeconds by sequence, deterministically across 100 shuffled runs', () => {
		const sequences = [0, 1, 2, 3];

		for (let run = 0; run < 100; run++) {
			const { manager, pitchedVoices } = setupManager({ maxVoicesPerChannelOverride: () => 4 });
			const instrument = makePitchedInstrument();

			for (const sequence of seededShuffle(sequences, run)) {
				const voice = manager.start(
					makeRequest({
						channelId: 'ch-1',
						instrument,
						midiNote: 60 + sequence,
						startAtSeconds: 5,
						sequence
					}),
					'normal'
				);
				expect(voice).not.toBeNull();
			}

			// A fifth note at the same instant forces a steal among the four tied voices.
			const extra = manager.start(
				makeRequest({
					channelId: 'ch-1',
					instrument,
					midiNote: 99,
					startAtSeconds: 5,
					sequence: 100
				}),
				'normal'
			);
			expect(extra).not.toBeNull();

			const releasing = pitchedVoices.filter((voice) => voice.isReleasing);
			expect(releasing).toHaveLength(1);
			expect(releasing[0]?.request.sequence).toBe(0);
		}
	});

	it('allows exactly one active voice for a monophonic instrument', () => {
		const { manager, pitchedVoices } = setupManager();
		const instrument = makePitchedInstrument({ polyphonic: false });

		const first = manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 0, sequence: 0 }),
			'normal'
		);
		const second = manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 1, sequence: 1 }),
			'normal'
		);

		expect(first).not.toBeNull();
		expect(second).not.toBeNull();
		expect(pitchedVoices[0]?.isReleasing).toBe(true);
		expect(manager.activeVoiceCount).toBe(1);
	});

	it('releaseAll clears the active set', () => {
		const { manager, pitchedVoices } = setupManager();
		const instrument = makePitchedInstrument();
		manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 0, sequence: 0 }),
			'normal'
		);
		manager.start(
			makeRequest({ channelId: 'ch-2', instrument, startAtSeconds: 1, sequence: 1 }),
			'normal'
		);
		expect(manager.activeVoiceCount).toBe(2);

		manager.releaseAll(5);

		expect(manager.activeVoiceCount).toBe(0);
		expect(pitchedVoices.every((voice) => voice.isReleasing)).toBe(true);
	});

	it('stopAll clears the active set', () => {
		const { manager, pitchedVoices } = setupManager();
		const instrument = makePitchedInstrument();
		manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 0, sequence: 0 }),
			'normal'
		);
		manager.start(
			makeRequest({ channelId: 'ch-2', instrument, startAtSeconds: 1, sequence: 1 }),
			'normal'
		);
		expect(manager.activeVoiceCount).toBe(2);

		manager.stopAll(5);

		expect(manager.activeVoiceCount).toBe(0);
		expect(pitchedVoices.every((voice) => voice.stoppedAtSeconds === 5)).toBe(true);
	});

	it('reclaims a voice that reports onEnded', () => {
		const { manager, pitchedVoices } = setupManager();
		const instrument = makePitchedInstrument();
		manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 0, sequence: 0 }),
			'normal'
		);
		expect(manager.activeVoiceCount).toBe(1);

		pitchedVoices[0]?.endNow();

		expect(manager.activeVoiceCount).toBe(0);
	});

	it('stopChokeGroup stops only voices in its group', () => {
		const { manager, percussionVoices } = setupManager();
		const groupA = makePercussionInstrument('group-a');
		const groupB = makePercussionInstrument('group-b');
		manager.start(
			makeRequest({ channelId: 'ch-1', instrument: groupA, startAtSeconds: 0, sequence: 0 }),
			'normal'
		);
		manager.start(
			makeRequest({ channelId: 'ch-2', instrument: groupB, startAtSeconds: 0, sequence: 1 }),
			'normal'
		);

		manager.stopChokeGroup('group-a', 3);

		expect(manager.activeVoiceCount).toBe(1);
		expect(percussionVoices[0]?.stoppedAtSeconds).toBe(3);
		expect(percussionVoices[1]?.stoppedAtSeconds).toBeNull();
	});

	it('dispose stops every voice and leaves activeVoiceCount at 0', () => {
		const { manager, pitchedVoices } = setupManager();
		const instrument = makePitchedInstrument();
		manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 0, sequence: 0 }),
			'normal'
		);
		manager.start(
			makeRequest({ channelId: 'ch-2', instrument, startAtSeconds: 1, sequence: 1 }),
			'normal'
		);

		manager.dispose();

		expect(manager.activeVoiceCount).toBe(0);
		expect(pitchedVoices.every((voice) => voice.stoppedAtSeconds !== null)).toBe(true);
	});

	it('stopAll after releaseAll still hard-stops every release tail (no tail survives a stop)', () => {
		const { manager, pitchedVoices } = setupManager();
		const instrument = makePitchedInstrument();
		manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 0, sequence: 0 }),
			'normal'
		);
		manager.start(
			makeRequest({ channelId: 'ch-2', instrument, startAtSeconds: 1, sequence: 1 }),
			'normal'
		);

		manager.releaseAll(5);
		expect(manager.activeVoiceCount).toBe(0);
		// Released, not yet stopped — the tail is still owned by the manager even though it no
		// longer counts toward the active set.
		expect(pitchedVoices.every((voice) => voice.stoppedAtSeconds === null)).toBe(true);

		manager.stopAll(9);

		expect(pitchedVoices.every((voice) => voice.stoppedAtSeconds === 9)).toBe(true);
	});

	it('dispose after releaseAll still stops every release tail', () => {
		const { manager, pitchedVoices } = setupManager();
		const instrument = makePitchedInstrument();
		manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 0, sequence: 0 }),
			'normal'
		);
		manager.start(
			makeRequest({ channelId: 'ch-2', instrument, startAtSeconds: 1, sequence: 1 }),
			'normal'
		);

		manager.releaseAll(5);
		expect(pitchedVoices.every((voice) => voice.stoppedAtSeconds === null)).toBe(true);

		manager.dispose();

		expect(manager.activeVoiceCount).toBe(0);
		expect(pitchedVoices.every((voice) => voice.stoppedAtSeconds !== null)).toBe(true);
	});

	it('forwards the allocation priority so a voice reports it truthfully', () => {
		const { manager, pitchedVoices } = setupManager();
		const instrument = makePitchedInstrument();

		manager.start(
			makeRequest({ channelId: 'ch-1', instrument, startAtSeconds: 0, sequence: 0 }),
			'low'
		);

		expect(pitchedVoices[0]?.priority).toBe('low');
	});
});
