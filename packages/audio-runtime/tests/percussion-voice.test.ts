import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from '../src/engine/audio-engine.js';
import { PlaybackError } from '../src/errors.js';
import { getPercussionPreset } from '../src/presets/percussion-presets.js';
import { getPitchedPreset } from '../src/presets/pitched-presets.js';
import { velocityToGain } from '../src/synth/conversions.js';
import { createPercussionVoiceFactory } from '../src/synth/percussion-voice.js';
import type { Voice } from '../src/synth/voice.js';
import type { PercussionInstrumentDefinition } from '../src/types/instrument.js';
import { buildSong, notesEvery } from './fakes/build-song.js';
import {
	asAudioNode,
	asBaseAudioContext,
	asFakeBiquadFilterNode,
	asFakeBufferSourceNode,
	asFakeGainNode,
	asFakeOscillatorNode,
	createFakeAudioContext
} from './fakes/fake-audio-context.js';
import type {
	FakeAudioContext,
	FakeAudioNode,
	FakeAutomationCall,
	FakeBiquadFilterNode,
	FakeBufferSourceNode,
	FakeGainNode,
	FakeOscillatorNode
} from './fakes/fake-audio-context.js';

const START_AT_SECONDS = 1;

function makeInstrument(overrides?: {
	oscillatorLayer?: Partial<PercussionInstrumentDefinition['oscillatorLayer']>;
	noiseLayer?: Partial<PercussionInstrumentDefinition['noiseLayer']>;
	rootMidiNote?: number;
	chokeGroup?: string | null;
}): PercussionInstrumentDefinition {
	return {
		kind: 'percussion',
		presetId: null,
		oscillatorLayer: {
			enabled: true,
			pitchTracksNote: false,
			waveform: 'sine',
			startFrequencyHz: 200,
			endFrequencyHz: 60,
			pitchDecaySeconds: 0.05,
			attackSeconds: 0.001,
			decaySeconds: 0.2,
			sustainLevel: 0,
			releaseSeconds: 0.05,
			gain: 0.8,
			...overrides?.oscillatorLayer
		},
		noiseLayer: {
			enabled: true,
			filterTracksNote: false,
			filterType: 'highpass',
			filterFrequencyHz: 3000,
			filterQ: 1,
			attackSeconds: 0.001,
			decaySeconds: 0.1,
			sustainLevel: 0,
			releaseSeconds: 0.04,
			gain: 0.6,
			...overrides?.noiseLayer
		},
		rootMidiNote: overrides?.rootMidiNote ?? 60,
		chokeGroup: overrides?.chokeGroup ?? null
	};
}

interface VoiceHarness {
	fake: FakeAudioContext;
	voice: Voice;
	destination: FakeAudioNode;
	/** Only the nodes this voice created, in creation order. */
	nodes: readonly FakeAudioNode[];
	oscillator: FakeOscillatorNode | null;
	oscillatorEnvelopeGain: FakeGainNode | null;
	oscillatorLayerGain: FakeGainNode | null;
	noiseSource: FakeBufferSourceNode | null;
	filter: FakeBiquadFilterNode | null;
	noiseEnvelopeGain: FakeGainNode | null;
	noiseLayerGain: FakeGainNode | null;
}

function startVoice(input: {
	instrument: PercussionInstrumentDefinition;
	midiNote?: number;
	velocity?: number;
	startAtSeconds?: number;
	releaseAtSeconds?: number;
	fake?: FakeAudioContext;
	destination?: FakeAudioNode;
}): VoiceHarness {
	const fake = input.fake ?? createFakeAudioContext();
	const destination = input.destination ?? fake.createGain();
	const nodesBefore = fake.createdNodes.length;

	const voice = createPercussionVoiceFactory().create({
		channelId: 'ch-1',
		instrument: input.instrument,
		midiNote: input.midiNote ?? 36,
		velocity: input.velocity ?? 1,
		startAtSeconds: input.startAtSeconds ?? START_AT_SECONDS,
		releaseAtSeconds: input.releaseAtSeconds ?? Infinity,
		destination: asAudioNode(destination),
		context: asBaseAudioContext(fake)
	});

	const nodes = fake.createdNodes.slice(nodesBefore);
	const gains = nodes.filter((node) => node.nodeKind === 'gain').map(asFakeGainNode);
	const oscillator = nodes.find((node) => node.nodeKind === 'oscillator');
	const noiseSource = nodes.find((node) => node.nodeKind === 'buffer-source');
	const filter = nodes.find((node) => node.nodeKind === 'biquad-filter');
	// The oscillator layer is always built first, so its two gains lead when both layers exist.
	const oscillatorGainCount = oscillator === undefined ? 0 : 2;

	return {
		fake,
		voice,
		destination,
		nodes,
		oscillator: oscillator === undefined ? null : asFakeOscillatorNode(oscillator),
		oscillatorEnvelopeGain: oscillator === undefined ? null : (gains[0] as FakeGainNode),
		oscillatorLayerGain: oscillator === undefined ? null : (gains[1] as FakeGainNode),
		noiseSource: noiseSource === undefined ? null : asFakeBufferSourceNode(noiseSource),
		filter: filter === undefined ? null : asFakeBiquadFilterNode(filter),
		noiseEnvelopeGain:
			noiseSource === undefined ? null : (gains[oscillatorGainCount] as FakeGainNode),
		noiseLayerGain:
			noiseSource === undefined ? null : (gains[oscillatorGainCount + 1] as FakeGainNode)
	};
}

/** Every automation call the voice scheduled, keyed by param — the whole observable behavior. */
function automationOf(harness: VoiceHarness): Record<string, readonly FakeAutomationCall[]> {
	return {
		oscillatorFrequency: harness.oscillator?.frequency.automation ?? [],
		oscillatorEnvelope: harness.oscillatorEnvelopeGain?.gain.automation ?? [],
		oscillatorLayerGain: harness.oscillatorLayerGain?.gain.automation ?? [],
		filterFrequency: harness.filter?.frequency.automation ?? [],
		filterQ: harness.filter?.Q.automation ?? [],
		noiseEnvelope: harness.noiseEnvelopeGain?.gain.automation ?? [],
		noiseLayerGain: harness.noiseLayerGain?.gain.automation ?? []
	};
}

/** Automation times, rounded past float noise: `1 + 0.001 + 0.2` is not exactly `1.201`. */
function timesOf(calls: readonly FakeAutomationCall[]): number[] {
	return calls.map((call) => Number(call.atSeconds.toFixed(6)));
}

/** The value each envelope ramps up to — the velocity-scaled peak, before the layer gain. */
function envelopePeakOf(gain: FakeGainNode): number {
	return gain.gain.automation[2]?.value as number;
}

describe('createPercussionVoiceFactory — graph', () => {
	it('builds one oscillator, one buffer source, one filter, and four gains when both layers are on', () => {
		const harness = startVoice({ instrument: makeInstrument() });

		expect(harness.nodes.filter((node) => node.nodeKind === 'oscillator')).toHaveLength(1);
		expect(harness.nodes.filter((node) => node.nodeKind === 'buffer-source')).toHaveLength(1);
		expect(harness.nodes.filter((node) => node.nodeKind === 'biquad-filter')).toHaveLength(1);
		expect(harness.nodes.filter((node) => node.nodeKind === 'gain')).toHaveLength(4);
	});

	it('keeps the two layers parallel, meeting only at the destination', () => {
		const harness = startVoice({ instrument: makeInstrument() });

		expect(harness.oscillator?.connectedTo).toEqual([harness.oscillatorEnvelopeGain]);
		expect(harness.oscillatorEnvelopeGain?.connectedTo).toEqual([harness.oscillatorLayerGain]);
		expect(harness.oscillatorLayerGain?.connectedTo).toEqual([harness.destination]);

		expect(harness.noiseSource?.connectedTo).toEqual([harness.filter]);
		expect(harness.filter?.connectedTo).toEqual([harness.noiseEnvelopeGain]);
		expect(harness.noiseEnvelopeGain?.connectedTo).toEqual([harness.noiseLayerGain]);
		expect(harness.noiseLayerGain?.connectedTo).toEqual([harness.destination]);
	});

	it('always filters an enabled noise layer, at the configured type, cutoff, and Q', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				noiseLayer: { filterType: 'bandpass', filterFrequencyHz: 1800, filterQ: 4.5 }
			})
		});

		expect(harness.filter?.type).toBe('bandpass');
		expect(harness.filter?.frequency.automation).toEqual([
			{ method: 'setValueAtTime', value: 1800, atSeconds: START_AT_SECONDS }
		]);
		expect(harness.filter?.Q.automation).toEqual([
			{ method: 'setValueAtTime', value: 4.5, atSeconds: START_AT_SECONDS }
		]);
	});

	it('points the noise source at the shared, non-looping context buffer', () => {
		const fake = createFakeAudioContext();
		const destination = fake.createGain();
		const first = startVoice({ instrument: makeInstrument(), fake, destination });
		const second = startVoice({ instrument: makeInstrument(), fake, destination });

		expect(first.noiseSource?.loop).toBe(false);
		expect(first.noiseSource?.buffer).not.toBeNull();
		// One buffer, two source nodes: AudioBufferSourceNode is single-use, the samples are not.
		expect(second.noiseSource?.buffer).toBe(first.noiseSource?.buffer);
		expect(second.noiseSource).not.toBe(first.noiseSource);
	});

	it('creates no oscillator when only the noise layer is enabled', () => {
		const harness = startVoice({
			instrument: makeInstrument({ oscillatorLayer: { enabled: false } })
		});

		expect(harness.nodes.filter((node) => node.nodeKind === 'oscillator')).toHaveLength(0);
		expect(harness.nodes.filter((node) => node.nodeKind === 'gain')).toHaveLength(2);
		expect(harness.noiseSource?.startedAtSeconds).toBe(START_AT_SECONDS);
		// Four attack/decay/sustain calls plus three release calls: a complete, self-contained hit.
		expect(harness.noiseEnvelopeGain?.gain.automation).toHaveLength(7);
		expect(harness.noiseLayerGain?.gain.automation).toEqual([
			{ method: 'setValueAtTime', value: 0.6, atSeconds: START_AT_SECONDS }
		]);
	});

	it('creates no buffer source or filter when only the oscillator layer is enabled', () => {
		const harness = startVoice({ instrument: makeInstrument({ noiseLayer: { enabled: false } }) });

		expect(harness.nodes.filter((node) => node.nodeKind === 'buffer-source')).toHaveLength(0);
		expect(harness.nodes.filter((node) => node.nodeKind === 'biquad-filter')).toHaveLength(0);
		expect(harness.nodes.filter((node) => node.nodeKind === 'gain')).toHaveLength(2);
		expect(harness.oscillator?.startedAtSeconds).toBe(START_AT_SECONDS);
		expect(harness.oscillatorLayerGain?.gain.automation).toEqual([
			{ method: 'setValueAtTime', value: 0.8, atSeconds: START_AT_SECONDS }
		]);
	});

	it('creates nothing, throws nothing, and still ends when both layers are disabled', async () => {
		let endedCount = 0;
		const harness = startVoice({
			instrument: makeInstrument({
				oscillatorLayer: { enabled: false },
				noiseLayer: { enabled: false }
			})
		});
		harness.voice.onEnded(() => {
			endedCount += 1;
		});

		expect(harness.nodes).toHaveLength(0);
		expect(endedCount).toBe(0);

		await Promise.resolve();

		expect(endedCount).toBe(1);
		// A silent voice must still tolerate the whole lifecycle being driven at it.
		expect(() => harness.voice.stop(2)).not.toThrow();
		expect(() => harness.voice.release(2)).not.toThrow();
	});
});

describe('createPercussionVoiceFactory — pitch sweep', () => {
	it('sets the start frequency then sweeps exponentially to the end over the pitch decay', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				oscillatorLayer: { startFrequencyHz: 150, endFrequencyHz: 45, pitchDecaySeconds: 0.06 }
			})
		});

		expect(harness.oscillator?.frequency.automation).toEqual([
			{ method: 'setValueAtTime', value: 150, atSeconds: START_AT_SECONDS },
			{ method: 'exponentialRampToValueAtTime', value: 45, atSeconds: START_AT_SECONDS + 0.06 }
		]);
	});

	it('floors a zero end frequency at 1Hz rather than throwing', () => {
		const harness = startVoice({
			instrument: makeInstrument({ oscillatorLayer: { endFrequencyHz: 0 } })
		});

		expect(harness.oscillator?.frequency.automation[1]).toEqual({
			method: 'exponentialRampToValueAtTime',
			value: 1,
			atSeconds: START_AT_SECONDS + 0.05
		});
	});

	it('schedules no ramp when the start and end frequencies are equal', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				oscillatorLayer: { startFrequencyHz: 220, endFrequencyHz: 220 }
			})
		});

		expect(harness.oscillator?.frequency.automation).toEqual([
			{ method: 'setValueAtTime', value: 220, atSeconds: START_AT_SECONDS }
		]);
	});

	it('uses the layer waveform directly as the native oscillator type', () => {
		const harness = startVoice({
			instrument: makeInstrument({ oscillatorLayer: { waveform: 'sawtooth' } })
		});

		expect(harness.oscillator?.type).toBe('sawtooth');
	});
});

describe('createPercussionVoiceFactory — layers are independent', () => {
	it('leaves the oscillator envelope untouched when only the noise decay changes', () => {
		const shortNoise = startVoice({ instrument: makeInstrument() });
		const longNoise = startVoice({
			instrument: makeInstrument({ noiseLayer: { decaySeconds: 0.9 } })
		});

		expect(longNoise.oscillatorEnvelopeGain?.gain.automation).toEqual(
			shortNoise.oscillatorEnvelopeGain?.gain.automation
		);
		expect(longNoise.noiseEnvelopeGain?.gain.automation).not.toEqual(
			shortNoise.noiseEnvelopeGain?.gain.automation
		);
	});

	it('holds each layer gain in its own constant gain node, outside the envelope peak', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				oscillatorLayer: { gain: 0.9 },
				noiseLayer: { gain: 0.25 }
			}),
			velocity: 0.5
		});

		// The envelopes peak at the velocity gain alone; layer balance is applied after them.
		expect(envelopePeakOf(harness.oscillatorEnvelopeGain as FakeGainNode)).toBe(
			velocityToGain(0.5)
		);
		expect(envelopePeakOf(harness.noiseEnvelopeGain as FakeGainNode)).toBe(velocityToGain(0.5));
		expect(harness.oscillatorLayerGain?.gain.automation).toEqual([
			{ method: 'setValueAtTime', value: 0.9, atSeconds: START_AT_SECONDS }
		]);
		expect(harness.noiseLayerGain?.gain.automation).toEqual([
			{ method: 'setValueAtTime', value: 0.25, atSeconds: START_AT_SECONDS }
		]);
	});

	it('scales both layers by velocity, proportionally', () => {
		const loud = startVoice({ instrument: makeInstrument(), velocity: 1 });
		const quiet = startVoice({ instrument: makeInstrument(), velocity: 0.5 });

		expect(envelopePeakOf(loud.oscillatorEnvelopeGain as FakeGainNode)).toBe(1);
		expect(envelopePeakOf(loud.noiseEnvelopeGain as FakeGainNode)).toBe(1);
		expect(envelopePeakOf(quiet.oscillatorEnvelopeGain as FakeGainNode)).toBe(0.25);
		expect(envelopePeakOf(quiet.noiseEnvelopeGain as FakeGainNode)).toBe(0.25);
	});

	it('ignores the MIDI note entirely while neither layer tracks it', () => {
		const low = startVoice({ instrument: makeInstrument(), midiNote: 36 });
		const middleC = startVoice({ instrument: makeInstrument(), midiNote: 60 });

		expect(automationOf(middleC)).toEqual(automationOf(low));
	});
});

describe('createPercussionVoiceFactory — note tracking', () => {
	it('transposes the whole sweep when the oscillator layer tracks the note', () => {
		const octaveDown = startVoice({
			instrument: makeInstrument({ oscillatorLayer: { pitchTracksNote: true } }),
			midiNote: 48
		});
		const octaveUp = startVoice({
			instrument: makeInstrument({ oscillatorLayer: { pitchTracksNote: true } }),
			midiNote: 72
		});

		// The designed 200 -> 60Hz drop keeps its interval; only its absolute pitch moves.
		expect(octaveDown.oscillator?.frequency.automation.map((call) => call.value)).toEqual([
			100, 30
		]);
		expect(octaveUp.oscillator?.frequency.automation.map((call) => call.value)).toEqual([400, 120]);
	});

	it('transposes the filter cutoff when the noise layer tracks the note', () => {
		const harness = startVoice({
			instrument: makeInstrument({ noiseLayer: { filterTracksNote: true } }),
			midiNote: 72
		});

		expect(harness.filter?.frequency.automation).toEqual([
			{ method: 'setValueAtTime', value: 6000, atSeconds: START_AT_SECONDS }
		]);
	});

	it('tracks each layer independently — one may follow the note while the other does not', () => {
		const oscillatorOnly = startVoice({
			instrument: makeInstrument({ oscillatorLayer: { pitchTracksNote: true } }),
			midiNote: 72
		});
		const noiseOnly = startVoice({
			instrument: makeInstrument({ noiseLayer: { filterTracksNote: true } }),
			midiNote: 72
		});

		expect(oscillatorOnly.oscillator?.frequency.automation[0]?.value).toBe(400);
		expect(oscillatorOnly.filter?.frequency.automation[0]?.value).toBe(3000);
		expect(noiseOnly.oscillator?.frequency.automation[0]?.value).toBe(200);
		expect(noiseOnly.filter?.frequency.automation[0]?.value).toBe(6000);
	});

	it('sounds identical with tracking on or off at the root note', () => {
		const fixed = startVoice({ instrument: makeInstrument(), midiNote: 60 });
		const tracking = startVoice({
			instrument: makeInstrument({
				oscillatorLayer: { pitchTracksNote: true },
				noiseLayer: { filterTracksNote: true }
			}),
			midiNote: 60
		});

		expect(automationOf(tracking)).toEqual(automationOf(fixed));
	});

	it('measures the interval from rootMidiNote, not from middle C', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				oscillatorLayer: { pitchTracksNote: true },
				noiseLayer: { filterTracksNote: true },
				rootMidiNote: 36
			}),
			midiNote: 36
		});

		expect(harness.oscillator?.frequency.automation[0]?.value).toBe(200);
		expect(harness.filter?.frequency.automation[0]?.value).toBe(3000);
	});

	it('holds a tracked frequency inside the audible range at the extremes of the keyboard', () => {
		const instrument = makeInstrument({
			oscillatorLayer: { pitchTracksNote: true },
			noiseLayer: { filterTracksNote: true }
		});

		for (const midiNote of [0, 127]) {
			const harness = startVoice({ instrument, midiNote });
			const frequencies = [
				...(harness.oscillator?.frequency.automation ?? []),
				...(harness.filter?.frequency.automation ?? [])
			].map((call) => call.value);

			expect(frequencies.length).toBeGreaterThan(0);
			for (const frequencyHz of frequencies) {
				expect(frequencyHz).toBeGreaterThanOrEqual(1);
				expect(frequencyHz).toBeLessThanOrEqual(20_000);
			}
		}
	});
});

describe('createPercussionVoiceFactory — lifecycle', () => {
	it('releases each layer at the end of its own decay and stops both sources on the longer tail', () => {
		const harness = startVoice({ instrument: makeInstrument() });

		// Oscillator: 1 + 0.001 attack + 0.2 decay, then a 0.05 release, so the tail ends at 1.251.
		const oscillatorRelease = harness.oscillatorEnvelopeGain?.gain.automation.slice(4) ?? [];
		expect(oscillatorRelease.map((call) => [call.method, call.value])).toEqual([
			['cancelScheduledValues', 0],
			['setValueAtTime', 0],
			['linearRampToValueAtTime', 0]
		]);
		expect(timesOf(oscillatorRelease)).toEqual([1.201, 1.201, 1.251]);
		// Noise: 1 + 0.001 + 0.1, then 0.04 — a shorter, entirely independent tail.
		const noiseRelease = harness.noiseEnvelopeGain?.gain.automation.slice(4) ?? [];
		expect(timesOf(noiseRelease)).toEqual([1.101, 1.101, 1.141]);
		// Both sources stop 10ms past the longer of the two tails.
		expect(harness.oscillator?.stoppedAtSeconds).toBeCloseTo(1.261, 9);
		expect(harness.noiseSource?.stoppedAtSeconds).toBeCloseTo(1.261, 9);
		expect(harness.voice.isReleasing).toBe(true);
	});

	it('cuts the hit when the scheduled release lands before the natural tail', () => {
		const harness = startVoice({ instrument: makeInstrument(), releaseAtSeconds: 1.1 });

		const oscillatorRelease = harness.oscillatorEnvelopeGain?.gain.automation.slice(4) ?? [];
		expect(timesOf(oscillatorRelease)).toEqual([1.1, 1.1, 1.15]);
		// Mid-decay, so the release starts from the level the envelope actually holds, not the peak.
		expect(oscillatorRelease[1]?.value).toBeGreaterThan(0);
		expect(oscillatorRelease[1]?.value).toBeLessThan(1);
		expect(harness.oscillator?.stoppedAtSeconds).toBeCloseTo(1.16, 9);
	});

	it('never extends the hit for a release scheduled after the natural tail', () => {
		const oneShot = startVoice({ instrument: makeInstrument() });
		const heldLong = startVoice({ instrument: makeInstrument(), releaseAtSeconds: 9 });

		expect(automationOf(heldLong)).toEqual(automationOf(oneShot));
		expect(heldLong.oscillator?.stoppedAtSeconds).toBe(oneShot.oscillator?.stoppedAtSeconds);
	});

	it('keeps the longest legal noise envelope inside the shared buffer duration', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				oscillatorLayer: { enabled: false },
				noiseLayer: { attackSeconds: 0.5, decaySeconds: 2, releaseSeconds: 2 }
			})
		});
		const bufferDurationSeconds = (harness.noiseSource?.buffer as { duration: number }).duration;
		const playbackDurationSeconds =
			(harness.noiseSource?.stoppedAtSeconds as number) - START_AT_SECONDS;
		expect(bufferDurationSeconds).toBeGreaterThan(playbackDurationSeconds);
	});

	it('brings the tail forward on release() and never pushes it back', () => {
		const harness = startVoice({ instrument: makeInstrument() });

		harness.voice.release(1.05);
		expect(harness.oscillator?.stoppedAtSeconds).toBeCloseTo(1.11, 9);

		harness.voice.release(1.15);
		expect(harness.oscillator?.stoppedAtSeconds).toBeCloseTo(1.11, 9);
	});

	it('stop() ramps both layer gains to zero within 5ms and stops both sources at +6ms', () => {
		const harness = startVoice({ instrument: makeInstrument() });

		harness.voice.stop(7);

		for (const layerGain of [harness.oscillatorLayerGain, harness.noiseLayerGain]) {
			const hardStop = (layerGain as FakeGainNode).gain.automation.slice(1);
			expect(hardStop.map((call) => call.method)).toEqual([
				'cancelScheduledValues',
				'setValueAtTime',
				'linearRampToValueAtTime'
			]);
			expect(hardStop[2]?.value).toBe(0);
			expect(hardStop[2]?.atSeconds).toBeCloseTo(7.005, 9);
		}
		expect(harness.oscillator?.stoppedAtSeconds).toBeCloseTo(7.006, 9);
		expect(harness.noiseSource?.stoppedAtSeconds).toBeCloseTo(7.006, 9);
		expect(harness.voice.isReleasing).toBe(true);
	});

	it('ends once the last source ends, and disconnects every node it created', () => {
		const harness = startVoice({ instrument: makeInstrument() });
		let endedCount = 0;
		harness.voice.onEnded(() => {
			endedCount += 1;
		});

		harness.oscillator?.endNow();
		expect(endedCount).toBe(0);

		harness.noiseSource?.endNow();
		harness.noiseSource?.endNow();

		expect(endedCount).toBe(1);
		expect(harness.nodes).toHaveLength(7);
		expect(harness.nodes.every((node) => node.disposed)).toBe(true);
		expect(harness.destination.disposed).toBe(false);
	});

	it('dispose() disconnects its nodes without firing onEnded listeners', () => {
		const harness = startVoice({ instrument: makeInstrument() });
		let endedCount = 0;
		harness.voice.onEnded(() => {
			endedCount += 1;
		});

		harness.voice.dispose();

		expect(endedCount).toBe(0);
		expect(harness.nodes.every((node) => node.disposed)).toBe(true);
	});

	it('rejects a pitched instrument with a contextual error', () => {
		const fake = createFakeAudioContext();

		expect(() =>
			createPercussionVoiceFactory().create({
				channelId: 'ch-1',
				instrument: getPitchedPreset('square-lead').definition,
				midiNote: 60,
				velocity: 1,
				startAtSeconds: 0,
				releaseAtSeconds: 1,
				destination: asAudioNode(fake.createGain()),
				context: asBaseAudioContext(fake)
			})
		).toThrow(PlaybackError);
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

describe('audio engine with the percussion factory registered', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('plays every built-in preset as a two-layer hit', async () => {
		const presetIds = ['kick', 'snare', 'closed-hat', 'open-hat', 'tom', 'click', 'warning-hit'];
		for (const preset of presetIds) {
			const fake = createFakeAudioContext();
			const engine = createAudioEngine({ contextFactory: () => asBaseAudioContext(fake) });
			engine.loadProject(
				buildSong({
					channels: [
						{
							role: 'percussion',
							instrument: getPercussionPreset(preset).definition,
							notes: [{ tick: 0, durationTicks: 240, midiNote: 36 }]
						}
					]
				})
			);
			await engine.initialize();

			engine.play();
			runFor(fake, 0.5);

			expect(fake.createdNodes.filter((node) => node.nodeKind === 'oscillator')).toHaveLength(1);
			expect(fake.createdNodes.filter((node) => node.nodeKind === 'buffer-source')).toHaveLength(1);

			engine.dispose();
		}
	});

	it('starts percussion and pitched notes from the same timeline, at the same context times', async () => {
		const fake = createFakeAudioContext();
		const engine = createAudioEngine({ contextFactory: () => asBaseAudioContext(fake) });
		const notes = notesEvery({ count: 4, stepTicks: 480, durationTicks: 240, midiNote: 36 });
		engine.loadProject(
			buildSong({
				channels: [
					{
						id: 'drums',
						role: 'percussion',
						instrument: getPercussionPreset('kick').definition,
						notes
					},
					// A vibrato-free lead, so every oscillator in the run belongs to the signal path.
					{ id: 'lead', instrument: getPitchedPreset('square-harmony').definition, notes }
				]
			})
		);
		await engine.initialize();

		engine.play();
		runFor(fake, 2.5);

		const noiseStarts = fake.createdNodes
			.filter((node) => node.nodeKind === 'buffer-source')
			.map(asFakeBufferSourceNode)
			.map((source) => source.startedAtSeconds);
		const oscillatorStarts = fake.createdNodes
			.filter((node) => node.nodeKind === 'oscillator')
			.map(asFakeOscillatorNode)
			.map((oscillator) => oscillator.startedAtSeconds);

		expect(noiseStarts).toHaveLength(4);
		// Eight oscillators: one per kick body, one per lead note — no separate percussion clock.
		expect(oscillatorStarts).toHaveLength(8);
		for (const startAtSeconds of noiseStarts) {
			expect(oscillatorStarts.filter((time) => time === startAtSeconds)).toHaveLength(2);
		}

		engine.dispose();
	});

	it('previews a percussion channel as a single immediate hit', async () => {
		const fake = createFakeAudioContext();
		const engine = createAudioEngine({ contextFactory: () => asBaseAudioContext(fake) });
		engine.loadProject(
			buildSong({
				channels: [
					{
						role: 'percussion',
						instrument: getPercussionPreset('snare').definition,
						notes: [{ tick: 0, durationTicks: 240 }]
					}
				]
			})
		);
		await engine.initialize();

		engine.triggerPreview('ch-1', 38, 0.9);

		expect(fake.createdNodes.filter((node) => node.nodeKind === 'buffer-source')).toHaveLength(1);
		expect(engine.activeVoiceCount).toBe(1);

		engine.dispose();
	});
});
