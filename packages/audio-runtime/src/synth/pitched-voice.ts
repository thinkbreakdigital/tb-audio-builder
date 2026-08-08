/**
 * The real pitched voice: one oscillator, an ADSR amplitude envelope, an optional filter, optional
 * vibrato, and scheduled pitch bend (spec §4.3).
 *
 * ```text
 * OscillatorNode ──▶ [BiquadFilterNode] ──▶ GainNode(envelope) ──▶ destination
 *       ▲
 *       │ detune
 *       ├── vibrato: OscillatorNode(sine) ──▶ GainNode(depthCents)
 *       └── pitch bend: scheduled setValueAtTime automation
 * ```
 *
 * Every voice owns its own nodes. `OscillatorNode` is single-use by specification, so there is no
 * pooling and no shared mutable state between voices.
 */

import { CHOKE_STOP_RAMP_SECONDS } from '../constants.js';
import { PlaybackError } from '../errors.js';
import type { PitchedInstrumentDefinition } from '../types/instrument.js';
import { midiNoteToFrequencyHz, pitchBendToSemitones, velocityToGain } from './conversions.js';
import {
	adsrLevelAtSeconds,
	applyAttackDecaySustain,
	applyRelease,
	MIN_ENVELOPE_RAMP_SECONDS
} from './envelope.js';
import type { Voice, VoiceFactory, VoicePriority, VoiceStartRequest } from './voice.js';

const SEMITONES_PER_OCTAVE = 12;
const CENTS_PER_SEMITONE = 100;

/**
 * The oscillator is stopped this far past the end of its envelope tail, so the ramp to zero always
 * completes before the node is torn down.
 */
const OSCILLATOR_TAIL_MARGIN_SECONDS = 0.01;

class PitchedVoiceImpl implements Voice {
	readonly channelId: string;
	readonly midiNote: number;
	readonly startedAtSeconds: number;
	readonly priority: VoicePriority;

	private readonly instrument: PitchedInstrumentDefinition;
	private readonly peakValue: number;
	private oscillator: OscillatorNode | null;
	private envelopeGain: GainNode | null;
	private filter: BiquadFilterNode | null = null;
	private vibratoOscillator: OscillatorNode | null = null;
	private vibratoDepthGain: GainNode | null = null;

	private scheduledReleaseAtSeconds = Infinity;
	private tailEndSeconds = Infinity;
	private ended = false;
	private endedListeners: Array<() => void> = [];

	constructor(request: VoiceStartRequest, instrument: PitchedInstrumentDefinition) {
		const { context, destination, startAtSeconds } = request;

		this.channelId = request.channelId;
		this.midiNote = request.midiNote;
		this.startedAtSeconds = startAtSeconds;
		this.priority = request.priority ?? 'normal';
		this.instrument = instrument;
		this.peakValue = velocityToGain(request.velocity);

		const oscillator = context.createOscillator();
		this.oscillator = oscillator;
		// The four allowed waveforms are exactly the native OscillatorType values.
		oscillator.type = instrument.oscillator.waveform;
		oscillator.frequency.setValueAtTime(
			midiNoteToFrequencyHz(
				request.midiNote +
					instrument.oscillator.octaveOffset * SEMITONES_PER_OCTAVE +
					instrument.oscillator.semitoneOffset
			),
			startAtSeconds
		);
		// Fine detune is a base offset on `detune` rather than being folded into the frequency, so
		// vibrato and pitch bend add to the same param instead of fighting the frequency for it.
		oscillator.detune.setValueAtTime(instrument.oscillator.fineDetuneCents, startAtSeconds);

		const envelopeGain = context.createGain();
		this.envelopeGain = envelopeGain;
		applyAttackDecaySustain({
			param: envelopeGain.gain,
			startAtSeconds,
			peakValue: this.peakValue,
			settings: instrument.amplitudeEnvelope
		});

		if (instrument.filter.enabled) {
			const filter = context.createBiquadFilter();
			this.filter = filter;
			filter.type = instrument.filter.type;
			filter.frequency.setValueAtTime(instrument.filter.frequencyHz, startAtSeconds);
			filter.Q.setValueAtTime(instrument.filter.q, startAtSeconds);
			oscillator.connect(filter);
			filter.connect(envelopeGain);
		} else {
			// No bypassed filter node per voice — a disabled filter costs nothing.
			oscillator.connect(envelopeGain);
		}
		envelopeGain.connect(destination);

		const modulation = instrument.modulation;
		if (
			modulation.vibratoEnabled &&
			modulation.vibratoRateHz > 0 &&
			modulation.vibratoDepthCents > 0
		) {
			const lfo = context.createOscillator();
			this.vibratoOscillator = lfo;
			lfo.type = 'sine';
			lfo.frequency.setValueAtTime(modulation.vibratoRateHz, startAtSeconds);
			const depthGain = context.createGain();
			this.vibratoDepthGain = depthGain;
			// Depth is in cents into `detune`, so the vibrato interval is pitch-correct at every note.
			depthGain.gain.setValueAtTime(modulation.vibratoDepthCents, startAtSeconds);
			lfo.connect(depthGain);
			depthGain.connect(oscillator.detune);
			lfo.start(startAtSeconds);
		}

		oscillator.onended = (): void => {
			this.handleEnded();
		};
		oscillator.start(startAtSeconds);

		// Scheduling the whole note up front, release included, is what lets it survive a scheduler
		// window boundary without ever being revisited.
		if (Number.isFinite(request.releaseAtSeconds)) {
			this.scheduleRelease(request.releaseAtSeconds);
		}

		this.applyPitchBend(request);
	}

	get isReleasing(): boolean {
		return this.scheduledReleaseAtSeconds < Infinity;
	}

	release(atSeconds: number): void {
		// A steal releases a voice early; a second release must never push the tail later.
		if (this.ended || atSeconds >= this.scheduledReleaseAtSeconds) return;
		this.scheduleRelease(atSeconds);
	}

	steal(atSeconds: number): void {
		this.stop(atSeconds);
	}

	stop(atSeconds: number): void {
		const envelopeGain = this.envelopeGain;
		const oscillator = this.oscillator;
		if (envelopeGain === null || oscillator === null) return;

		// A hard cut still gets a short ramp — stopping an oscillator mid-cycle at full gain clicks.
		const gain = envelopeGain.gain;
		const currentValue = adsrLevelAtSeconds({
			startAtSeconds: this.startedAtSeconds,
			peakValue: this.peakValue,
			settings: this.instrument.amplitudeEnvelope,
			atSeconds
		});
		gain.cancelScheduledValues(atSeconds);
		gain.setValueAtTime(currentValue, atSeconds);
		gain.linearRampToValueAtTime(0, atSeconds + CHOKE_STOP_RAMP_SECONDS);

		const stopAtSeconds = atSeconds + CHOKE_STOP_RAMP_SECONDS + MIN_ENVELOPE_RAMP_SECONDS;
		this.scheduledReleaseAtSeconds = atSeconds;
		this.tailEndSeconds = atSeconds + CHOKE_STOP_RAMP_SECONDS;
		oscillator.stop(stopAtSeconds);
		this.vibratoOscillator?.stop(stopAtSeconds);
	}

	onEnded(listener: () => void): void {
		this.endedListeners.push(listener);
	}

	dispose(): void {
		this.endedListeners = [];
		if (this.oscillator !== null) this.oscillator.onended = null;
		this.disconnectNodes();
	}

	private scheduleRelease(atSeconds: number): void {
		const envelopeGain = this.envelopeGain;
		const oscillator = this.oscillator;
		if (envelopeGain === null || oscillator === null) return;

		this.scheduledReleaseAtSeconds = atSeconds;
		this.tailEndSeconds = applyRelease({
			param: envelopeGain.gain,
			releaseAtSeconds: atSeconds,
			settings: this.instrument.amplitudeEnvelope,
			fromValue: adsrLevelAtSeconds({
				startAtSeconds: this.startedAtSeconds,
				peakValue: this.peakValue,
				settings: this.instrument.amplitudeEnvelope,
				atSeconds
			})
		});
		// Re-stopping an already-scheduled oscillator is legal; the latest call wins.
		const stopAtSeconds = this.tailEndSeconds + OSCILLATOR_TAIL_MARGIN_SECONDS;
		oscillator.stop(stopAtSeconds);
		this.vibratoOscillator?.stop(stopAtSeconds);
	}

	/**
	 * Bends are stepped, not ramped: MIDI bend resolution is already fine-grained, and ramping
	 * between events would smear a fast bend into a glide.
	 */
	private applyPitchBend(request: VoiceStartRequest): void {
		const oscillator = this.oscillator;
		const rangeSemitones = this.instrument.modulation.pitchBendRangeSemitones;
		const points = request.pitchBendPoints;
		if (oscillator === null || rangeSemitones === 0 || points === undefined) return;

		const baseCents = this.instrument.oscillator.fineDetuneCents;
		for (const point of points) {
			if (point.atSeconds < request.startAtSeconds || point.atSeconds > this.tailEndSeconds) {
				continue;
			}
			oscillator.detune.setValueAtTime(
				baseCents + pitchBendToSemitones(point.value, rangeSemitones) * CENTS_PER_SEMITONE,
				point.atSeconds
			);
		}
	}

	private handleEnded(): void {
		if (this.ended) return;
		this.ended = true;
		const listeners = this.endedListeners;
		this.endedListeners = [];
		for (const listener of listeners) listener();
		this.disconnectNodes();
	}

	/** Drops every reference the voice holds so the nodes can be collected. */
	private disconnectNodes(): void {
		this.vibratoDepthGain?.disconnect();
		this.vibratoOscillator?.disconnect();
		this.filter?.disconnect();
		this.envelopeGain?.disconnect();
		this.oscillator?.disconnect();
		this.vibratoDepthGain = null;
		this.vibratoOscillator = null;
		this.filter = null;
		this.envelopeGain = null;
		this.oscillator = null;
	}
}

export function createPitchedVoiceFactory(): VoiceFactory {
	return {
		kind: 'pitched',
		create(request: VoiceStartRequest): Voice {
			if (request.instrument.kind !== 'pitched') {
				throw new PlaybackError(
					`createPitchedVoiceFactory: channel "${request.channelId}" supplied a ` +
						`"${request.instrument.kind}" instrument; the pitched factory only builds pitched voices.`
				);
			}
			return new PitchedVoiceImpl(request, request.instrument);
		}
	};
}
