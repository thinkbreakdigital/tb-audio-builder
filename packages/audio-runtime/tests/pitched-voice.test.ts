import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from '../src/engine/audio-engine.js';
import { PlaybackError } from '../src/errors.js';
import { getPitchedPreset } from '../src/presets/pitched-presets.js';
import { MIN_ENVELOPE_RAMP_SECONDS } from '../src/synth/envelope.js';
import { createPitchedVoiceFactory } from '../src/synth/pitched-voice.js';
import type { PitchBendPoint, Voice } from '../src/synth/voice.js';
import type { PitchedInstrumentDefinition } from '../src/types/instrument.js';
import { buildSong, notesEvery } from './fakes/build-song.js';
import {
	asAudioNode,
	asBaseAudioContext,
	asFakeBiquadFilterNode,
	asFakeGainNode,
	asFakeOscillatorNode,
	createFakeAudioContext
} from './fakes/fake-audio-context.js';
import type {
	FakeAudioContext,
	FakeAudioNode,
	FakeAutomationCall,
	FakeBiquadFilterNode,
	FakeGainNode,
	FakeOscillatorNode
} from './fakes/fake-audio-context.js';

const A4_MIDI_NOTE = 69;
const START_AT_SECONDS = 1;

function makeInstrument(overrides?: {
	oscillator?: Partial<PitchedInstrumentDefinition['oscillator']>;
	amplitudeEnvelope?: Partial<PitchedInstrumentDefinition['amplitudeEnvelope']>;
	filter?: Partial<PitchedInstrumentDefinition['filter']>;
	modulation?: Partial<PitchedInstrumentDefinition['modulation']>;
	voice?: Partial<PitchedInstrumentDefinition['voice']>;
}): PitchedInstrumentDefinition {
	return {
		kind: 'pitched',
		presetId: null,
		oscillator: {
			waveform: 'square',
			octaveOffset: 0,
			semitoneOffset: 0,
			fineDetuneCents: 0,
			...overrides?.oscillator
		},
		amplitudeEnvelope: {
			attackSeconds: 0.01,
			decaySeconds: 0.05,
			sustainLevel: 0.5,
			releaseSeconds: 0.2,
			...overrides?.amplitudeEnvelope
		},
		filter: {
			enabled: false,
			type: 'lowpass',
			frequencyHz: 20000,
			q: 1,
			...overrides?.filter
		},
		modulation: {
			vibratoEnabled: false,
			vibratoRateHz: 5,
			vibratoDepthCents: 0,
			pitchBendRangeSemitones: 2,
			...overrides?.modulation
		},
		voice: { polyphonic: true, maxVoices: 8, stealMode: 'oldest', ...overrides?.voice }
	};
}

interface VoiceHarness {
	fake: FakeAudioContext;
	voice: Voice;
	destination: FakeAudioNode;
	/** Only the nodes this voice created, in creation order. */
	nodes: readonly FakeAudioNode[];
	oscillator: FakeOscillatorNode;
	envelopeGain: FakeGainNode;
	filter: FakeBiquadFilterNode | null;
	vibratoOscillator: FakeOscillatorNode | null;
	vibratoGain: FakeGainNode | null;
}

function startVoice(input: {
	instrument: PitchedInstrumentDefinition;
	midiNote?: number;
	velocity?: number;
	startAtSeconds?: number;
	releaseAtSeconds?: number;
	pitchBendPoints?: readonly PitchBendPoint[];
	fake?: FakeAudioContext;
	destination?: FakeAudioNode;
}): VoiceHarness {
	const fake = input.fake ?? createFakeAudioContext();
	const destination = input.destination ?? fake.createGain();
	const nodesBefore = fake.createdNodes.length;

	const voice = createPitchedVoiceFactory().create({
		channelId: 'ch-1',
		instrument: input.instrument,
		midiNote: input.midiNote ?? A4_MIDI_NOTE,
		velocity: input.velocity ?? 1,
		startAtSeconds: input.startAtSeconds ?? START_AT_SECONDS,
		releaseAtSeconds: input.releaseAtSeconds ?? Infinity,
		destination: asAudioNode(destination),
		context: asBaseAudioContext(fake),
		pitchBendPoints: input.pitchBendPoints
	});

	const nodes = fake.createdNodes.slice(nodesBefore);
	const oscillators = nodes
		.filter((node) => node.nodeKind === 'oscillator')
		.map(asFakeOscillatorNode);
	const gains = nodes.filter((node) => node.nodeKind === 'gain').map(asFakeGainNode);
	const filters = nodes
		.filter((node) => node.nodeKind === 'biquad-filter')
		.map(asFakeBiquadFilterNode);

	return {
		fake,
		voice,
		destination,
		nodes,
		oscillator: oscillators[0] as FakeOscillatorNode,
		envelopeGain: gains[0] as FakeGainNode,
		filter: filters[0] ?? null,
		vibratoOscillator: oscillators[1] ?? null,
		vibratoGain: gains[1] ?? null
	};
}

function frequencyAt(harness: VoiceHarness): number {
	const call = harness.oscillator.frequency.automation[0] as FakeAutomationCall;
	return call.value;
}

describe('createPitchedVoiceFactory — pitch', () => {
	it('sets MIDI note 69 with no offsets to 440Hz', () => {
		const harness = startVoice({ instrument: makeInstrument() });

		expect(harness.oscillator.frequency.automation).toEqual([
			{ method: 'setValueAtTime', value: 440, atSeconds: START_AT_SECONDS }
		]);
	});

	it('halves the frequency an octave down, doubles it twelve semitones up, and combines both', () => {
		const down = startVoice({
			instrument: makeInstrument({ oscillator: { octaveOffset: -1 } })
		});
		const up = startVoice({
			instrument: makeInstrument({ oscillator: { semitoneOffset: 12 } })
		});
		const both = startVoice({
			instrument: makeInstrument({ oscillator: { octaveOffset: -1, semitoneOffset: 12 } })
		});

		expect(frequencyAt(down)).toBeCloseTo(220, 9);
		expect(frequencyAt(up)).toBeCloseTo(880, 9);
		expect(frequencyAt(both)).toBeCloseTo(440, 9);
	});

	it('writes fine detune to `detune` and leaves the frequency at 440', () => {
		const harness = startVoice({
			instrument: makeInstrument({ oscillator: { fineDetuneCents: 50 } })
		});

		expect(frequencyAt(harness)).toBe(440);
		expect(harness.oscillator.detune.automation).toEqual([
			{ method: 'setValueAtTime', value: 50, atSeconds: START_AT_SECONDS }
		]);
	});

	it('uses the instrument waveform directly as the native oscillator type', () => {
		const harness = startVoice({
			instrument: makeInstrument({ oscillator: { waveform: 'sawtooth' } })
		});

		expect(harness.oscillator.type).toBe('sawtooth');
	});
});

describe('createPitchedVoiceFactory — graph', () => {
	it('connects the oscillator straight to the envelope gain when the filter is disabled', () => {
		const harness = startVoice({ instrument: makeInstrument({ filter: { enabled: false } }) });

		expect(harness.nodes.filter((node) => node.nodeKind === 'biquad-filter')).toHaveLength(0);
		expect(harness.oscillator.connectedTo).toEqual([harness.envelopeGain]);
		expect(harness.envelopeGain.connectedTo).toEqual([harness.destination]);
	});

	it('wires an enabled filter between the oscillator and the envelope gain', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				filter: { enabled: true, type: 'bandpass', frequencyHz: 1200, q: 3.5 }
			})
		});
		const filter = harness.filter as FakeBiquadFilterNode;

		expect(filter.type).toBe('bandpass');
		expect(filter.frequency.automation).toEqual([
			{ method: 'setValueAtTime', value: 1200, atSeconds: START_AT_SECONDS }
		]);
		expect(filter.Q.automation).toEqual([
			{ method: 'setValueAtTime', value: 3.5, atSeconds: START_AT_SECONDS }
		]);
		expect(harness.oscillator.connectedTo).toEqual([filter]);
		expect(filter.connectedTo).toEqual([harness.envelopeGain]);
	});

	it('applies the velocity-scaled ADSR to the envelope gain', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				amplitudeEnvelope: {
					attackSeconds: 0.02,
					decaySeconds: 0.05,
					sustainLevel: 0.5,
					releaseSeconds: 0.2
				}
			}),
			velocity: 0.5
		});

		// velocityToGain(0.5) === 0.25.
		expect(harness.envelopeGain.gain.automation.map((call) => [call.method, call.value])).toEqual([
			['cancelScheduledValues', 1],
			['setValueAtTime', 0],
			['linearRampToValueAtTime', 0.25],
			['linearRampToValueAtTime', 0.125]
		]);
	});

	it('shares no nodes between two voices built from the same instrument', () => {
		const fake = createFakeAudioContext();
		const destination = fake.createGain();
		const instrument = makeInstrument({
			filter: { enabled: true },
			modulation: { vibratoEnabled: true, vibratoRateHz: 5, vibratoDepthCents: 10 }
		});

		const first = startVoice({ instrument, fake, destination });
		const second = startVoice({ instrument, fake, destination });

		expect(first.nodes).toHaveLength(5);
		expect(second.nodes).toHaveLength(5);
		const shared = first.nodes.filter((node) => second.nodes.includes(node));
		expect(shared).toEqual([]);
	});
});

describe('createPitchedVoiceFactory — vibrato', () => {
	it('adds exactly one LFO oscillator and one depth gain routed into detune', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				modulation: { vibratoEnabled: true, vibratoRateHz: 6, vibratoDepthCents: 14 }
			})
		});
		const lfo = harness.vibratoOscillator as FakeOscillatorNode;
		const depthGain = harness.vibratoGain as FakeGainNode;

		expect(harness.nodes.filter((node) => node.nodeKind === 'oscillator')).toHaveLength(2);
		expect(lfo.type).toBe('sine');
		expect(lfo.frequency.automation).toEqual([
			{ method: 'setValueAtTime', value: 6, atSeconds: START_AT_SECONDS }
		]);
		expect(lfo.startedAtSeconds).toBe(START_AT_SECONDS);
		expect(depthGain.gain.automation).toEqual([
			{ method: 'setValueAtTime', value: 14, atSeconds: START_AT_SECONDS }
		]);
		expect(lfo.connectedTo).toEqual([depthGain]);
		expect(depthGain.connectedToParams).toEqual([harness.oscillator.detune]);
	});

	it('creates no extra nodes when vibrato is disabled or has zero rate or depth', () => {
		const off = startVoice({
			instrument: makeInstrument({
				modulation: { vibratoEnabled: false, vibratoRateHz: 6, vibratoDepthCents: 14 }
			})
		});
		const zeroDepth = startVoice({
			instrument: makeInstrument({
				modulation: { vibratoEnabled: true, vibratoRateHz: 6, vibratoDepthCents: 0 }
			})
		});
		const zeroRate = startVoice({
			instrument: makeInstrument({
				modulation: { vibratoEnabled: true, vibratoRateHz: 0, vibratoDepthCents: 14 }
			})
		});

		for (const harness of [off, zeroDepth, zeroRate]) {
			expect(harness.nodes).toHaveLength(2); // oscillator + envelope gain only
		}
	});
});

describe('createPitchedVoiceFactory — pitch bend', () => {
	const bendPoints: readonly PitchBendPoint[] = [
		{ atSeconds: 1.25, value: 1 },
		{ atSeconds: 1.5, value: -0.5 }
	];

	it('schedules stepped detune automation on top of the fine detune offset', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				oscillator: { fineDetuneCents: 10 },
				modulation: { pitchBendRangeSemitones: 2 }
			}),
			pitchBendPoints: bendPoints
		});

		expect(harness.oscillator.detune.automation).toEqual([
			{ method: 'setValueAtTime', value: 10, atSeconds: START_AT_SECONDS },
			{ method: 'setValueAtTime', value: 210, atSeconds: 1.25 },
			{ method: 'setValueAtTime', value: -90, atSeconds: 1.5 }
		]);
	});

	it('schedules no bend automation when the bend range is zero', () => {
		const harness = startVoice({
			instrument: makeInstrument({ modulation: { pitchBendRangeSemitones: 0 } }),
			pitchBendPoints: bendPoints
		});

		expect(harness.oscillator.detune.automation).toHaveLength(1);
	});

	it('ignores bend points outside the note, including past the release tail', () => {
		const harness = startVoice({
			instrument: makeInstrument({ amplitudeEnvelope: { releaseSeconds: 0.2 } }),
			releaseAtSeconds: 2,
			pitchBendPoints: [
				{ atSeconds: 0.5, value: 1 }, // before the note starts
				{ atSeconds: 1.5, value: 1 }, // inside
				{ atSeconds: 9, value: 1 } // past the 2.2s tail end
			]
		});

		expect(harness.oscillator.detune.automation).toEqual([
			{ method: 'setValueAtTime', value: 0, atSeconds: START_AT_SECONDS },
			{ method: 'setValueAtTime', value: 200, atSeconds: 1.5 }
		]);
	});
});

describe('createPitchedVoiceFactory — lifecycle', () => {
	it('schedules the release and the oscillator stop up front for a finite release time', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				amplitudeEnvelope: {
					attackSeconds: 0.01,
					decaySeconds: 0.05,
					sustainLevel: 0.5,
					releaseSeconds: 0.2
				}
			}),
			releaseAtSeconds: 3
		});

		expect(harness.voice.isReleasing).toBe(true);
		const release = harness.envelopeGain.gain.automation.slice(4);
		expect(release).toEqual([
			{ method: 'cancelScheduledValues', value: 0.5, atSeconds: 3 },
			{ method: 'setValueAtTime', value: 0.5, atSeconds: 3 },
			{ method: 'linearRampToValueAtTime', value: 0, atSeconds: 3.2 }
		]);
		// Tail end 3.2s plus the 10ms margin that lets the ramp finish.
		expect(harness.oscillator.stoppedAtSeconds).toBeCloseTo(3.21, 9);
	});

	it('releases from the actual attack level for a short note with a slow attack', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				amplitudeEnvelope: {
					attackSeconds: 0.6,
					decaySeconds: 0.1,
					sustainLevel: 0.85,
					releaseSeconds: 0.2
				}
			}),
			releaseAtSeconds: 1.1
		});

		const releaseAnchor = harness.envelopeGain.gain.automation[5];
		expect(releaseAnchor?.method).toBe('setValueAtTime');
		expect(releaseAnchor?.value).toBeCloseTo(1 / 6, 9);
		expect(releaseAnchor?.value).not.toBeCloseTo(0.85, 3);
	});

	it('holds indefinitely for an infinite release time until release() is called', () => {
		const harness = startVoice({
			instrument: makeInstrument({ amplitudeEnvelope: { releaseSeconds: 0.2 } }),
			releaseAtSeconds: Infinity
		});

		expect(harness.voice.isReleasing).toBe(false);
		expect(harness.oscillator.stoppedAtSeconds).toBeNull();

		harness.voice.release(5);

		expect(harness.voice.isReleasing).toBe(true);
		expect(harness.oscillator.stoppedAtSeconds).toBeCloseTo(5.21, 9);
	});

	it('brings a scheduled release forward when stolen, and never pushes it later', () => {
		const harness = startVoice({
			instrument: makeInstrument({ amplitudeEnvelope: { releaseSeconds: 0.2 } }),
			releaseAtSeconds: 4
		});

		harness.voice.release(2);
		expect(harness.oscillator.stoppedAtSeconds).toBeCloseTo(2.21, 9);

		harness.voice.release(3);
		expect(harness.oscillator.stoppedAtSeconds).toBeCloseTo(2.21, 9);
	});

	it('stop() ramps the gain to zero within 5ms and stops the oscillator at +6ms', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				modulation: { vibratoEnabled: true, vibratoRateHz: 5, vibratoDepthCents: 10 }
			})
		});

		harness.voice.stop(7);

		const hardStop = harness.envelopeGain.gain.automation.slice(4);
		expect(hardStop.map((call) => [call.method, call.value])).toEqual([
			['cancelScheduledValues', 0.5],
			['setValueAtTime', 0.5],
			['linearRampToValueAtTime', 0]
		]);
		expect(hardStop[2]?.atSeconds).toBeCloseTo(7.005, 9);
		expect(harness.oscillator.stoppedAtSeconds).toBeCloseTo(7.006, 9);
		expect((harness.vibratoOscillator as FakeOscillatorNode).stoppedAtSeconds).toBeCloseTo(
			7.006,
			9
		);
	});

	it('disconnects every node it created and notifies each listener exactly once on end', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				filter: { enabled: true },
				modulation: { vibratoEnabled: true, vibratoRateHz: 5, vibratoDepthCents: 10 }
			}),
			releaseAtSeconds: 2
		});
		let endedCount = 0;
		harness.voice.onEnded(() => {
			endedCount += 1;
		});

		harness.oscillator.endNow();
		harness.oscillator.endNow();

		expect(endedCount).toBe(1);
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

	it('rejects a percussion instrument with a contextual error', () => {
		const fake = createFakeAudioContext();
		const percussion = buildSong({ channels: [{ role: 'percussion' }] }).channels[0]?.instrument;

		expect(() =>
			createPitchedVoiceFactory().create({
				channelId: 'ch-1',
				instrument: percussion as never,
				midiNote: 60,
				velocity: 1,
				startAtSeconds: 0,
				releaseAtSeconds: 1,
				destination: asAudioNode(fake.createGain()),
				context: asBaseAudioContext(fake)
			})
		).toThrow(PlaybackError);
	});

	it('never schedules a zero-length ramp', () => {
		const harness = startVoice({
			instrument: makeInstrument({
				amplitudeEnvelope: {
					attackSeconds: 0,
					decaySeconds: 0,
					sustainLevel: 0,
					releaseSeconds: 0
				}
			}),
			startAtSeconds: 0,
			releaseAtSeconds: 1
		});

		const ramps = harness.envelopeGain.gain.automation.filter(
			(call) => call.method === 'linearRampToValueAtTime'
		);
		expect(ramps.map((call) => call.atSeconds)).toEqual([
			MIN_ENVELOPE_RAMP_SECONDS,
			2 * MIN_ENVELOPE_RAMP_SECONDS,
			1 + MIN_ENVELOPE_RAMP_SECONDS
		]);
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

/**
 * The note-producing oscillators, in creation order. A vibrato LFO is excluded: it is the only
 * oscillator that feeds a gain routed into an `AudioParam` rather than into the signal path.
 */
function voiceOscillators(fake: FakeAudioContext): FakeOscillatorNode[] {
	return fake.createdNodes
		.filter((node) => node.nodeKind === 'oscillator')
		.map(asFakeOscillatorNode)
		.filter((oscillator) =>
			oscillator.connectedTo.every((target) => target.connectedToParams.length === 0)
		);
}

describe('audio engine with the pitched factory registered', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('produces one correctly tuned oscillator voice per note of a pitched track', async () => {
		const fake = createFakeAudioContext();
		const engine = createAudioEngine({ contextFactory: () => asBaseAudioContext(fake) });
		engine.loadProject(
			buildSong({
				channels: [
					{
						instrument: getPitchedPreset('square-harmony').definition,
						notes: notesEvery({ count: 4, stepTicks: 960, durationTicks: 480, midiNote: 69 })
					}
				]
			})
		);
		await engine.initialize();

		engine.play();
		runFor(fake, 3.2);

		const oscillators = voiceOscillators(fake);
		expect(oscillators).toHaveLength(4);
		for (const oscillator of oscillators) {
			expect(oscillator.type).toBe('square');
			expect(oscillator.frequency.automation[0]?.value).toBe(440);
		}
		// square-harmony filters at 3500Hz, so each voice built its own filter node.
		expect(fake.createdNodes.filter((node) => node.nodeKind === 'biquad-filter')).toHaveLength(4);

		engine.dispose();
	});

	it('uses a swapped instrument for future notes and leaves sounding voices alone', async () => {
		const fake = createFakeAudioContext();
		const engine = createAudioEngine({ contextFactory: () => asBaseAudioContext(fake) });
		engine.loadProject(
			buildSong({
				channels: [
					{
						instrument: getPitchedPreset('soft-sine-lead').definition,
						notes: notesEvery({ count: 2, stepTicks: 1920, durationTicks: 480, midiNote: 69 })
					}
				]
			})
		);
		await engine.initialize();

		engine.play();
		runFor(fake, 1);
		expect(voiceOscillators(fake)).toHaveLength(1);

		engine.setChannelInstrument('ch-1', getPitchedPreset('triangle-bass').definition);
		runFor(fake, 1.5);

		const oscillators = voiceOscillators(fake);
		expect(oscillators).toHaveLength(2);
		expect(oscillators[0]?.type).toBe('sine');
		expect(oscillators[0]?.frequency.automation[0]?.value).toBe(440);
		// triangle-bass drops an octave, so the second note is a triangle at 220Hz.
		expect(oscillators[1]?.type).toBe('triangle');
		expect(oscillators[1]?.frequency.automation[0]?.value).toBeCloseTo(220, 9);

		engine.dispose();
	});

	it('keeps a monophonic channel at one voice and a drone channel at maxDroneVoices', async () => {
		const fake = createFakeAudioContext();
		const engine = createAudioEngine({ contextFactory: () => asBaseAudioContext(fake) });
		// Four overlapping whole notes per channel, all sounding at once without a limit.
		const notes = notesEvery({ count: 4, stepTicks: 120, durationTicks: 3840, midiNote: 60 });
		engine.loadProject(
			buildSong({
				channels: [
					{ id: 'mono', instrument: getPitchedPreset('square-lead').definition, notes },
					{ id: 'drone', instrument: getPitchedPreset('filtered-drone').definition, notes }
				]
			})
		);
		await engine.initialize();

		engine.play();
		runFor(fake, 1);

		// Three voices remain allocatable; five replaced voices are still represented by the fake's
		// bounded steal tails because the fake clock does not emit scheduled `ended` events.
		expect(engine.activeVoiceCount).toBe(8);

		engine.dispose();
	});

	it('carries a held pitch bend into note start and delivers later bends at derived times', async () => {
		const fake = createFakeAudioContext();
		const engine = createAudioEngine({ contextFactory: () => asBaseAudioContext(fake) });
		engine.loadProject(
			buildSong({
				channels: [
					{
						instrument: getPitchedPreset('soft-sine-lead').definition,
						notes: [{ tick: 960, durationTicks: 960, midiNote: 69 }],
						// 480 ticks = 0.5s at 480 PPQ / 120 BPM. Only the middle two fall inside the note.
						pitchBends: [
							{ tick: 0, value: 1 },
							{ tick: 1440, value: 1 },
							{ tick: 1680, value: -0.5 },
							{ tick: 2880, value: 1 }
						]
					}
				],
				durationTicks: 3840
			})
		);
		await engine.initialize();

		engine.play();
		runFor(fake, 1.2);

		const oscillator = voiceOscillators(fake)[0] as FakeOscillatorNode;
		// soft-sine-lead bends +/- 2 semitones, so value 1 is +200 cents and -0.5 is -100.
		expect(oscillator.detune.automation.map((call) => [call.method, call.value])).toEqual([
			['setValueAtTime', 0],
			['setValueAtTime', 200],
			['setValueAtTime', 200],
			['setValueAtTime', -100]
		]);
		const noteStartSeconds = oscillator.frequency.automation[0]?.atSeconds as number;
		expect(oscillator.detune.automation[1]?.atSeconds).toBeCloseTo(noteStartSeconds, 9);
		expect(oscillator.detune.automation[2]?.atSeconds).toBeCloseTo(noteStartSeconds + 0.5, 9);
		expect(oscillator.detune.automation[3]?.atSeconds).toBeCloseTo(noteStartSeconds + 0.75, 9);

		engine.dispose();
	});

	it('starts every channel from the same playback origin, so tracks stay sample-aligned', async () => {
		const fake = createFakeAudioContext();
		const engine = createAudioEngine({ contextFactory: () => asBaseAudioContext(fake) });
		const notes = notesEvery({ count: 4, stepTicks: 960, durationTicks: 480, midiNote: 69 });
		engine.loadProject(
			buildSong({
				channels: [
					{ id: 'a', instrument: getPitchedPreset('soft-sine-lead').definition, notes },
					{ id: 'b', instrument: getPitchedPreset('soft-sine-lead').definition, notes }
				]
			})
		);
		await engine.initialize();

		engine.play();
		runFor(fake, 3.2);

		const startTimes = voiceOscillators(fake).map((oscillator) => oscillator.startedAtSeconds);
		expect(startTimes).toHaveLength(8);
		// Each of the four note times appears exactly twice, bit-for-bit identical across channels.
		const grouped = new Map<number | null | undefined, number>();
		for (const time of startTimes) grouped.set(time, (grouped.get(time) ?? 0) + 1);
		expect([...grouped.values()]).toEqual([2, 2, 2, 2]);

		engine.dispose();
	});
});
