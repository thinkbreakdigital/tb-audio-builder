/**
 * The real percussion voice: two fully parallel layers — a pitch-swept oscillator and filtered
 * white noise — that meet only at the voice output (spec §4.2).
 *
 * ```text
 * OscillatorNode ─────────▶ GainNode(osc envelope) ──▶ GainNode(osc layer gain) ────┐
 *                                                                                   ├─▶ destination
 * AudioBufferSourceNode ──▶ BiquadFilterNode ──▶ GainNode(noise envelope)           │
 *                                            ──▶ GainNode(noise layer gain) ────────┘
 * ```
 *
 * Each layer carries its own envelope, its own peak, and its own release, so editing one never
 * moves the other. A disabled layer creates no nodes at all, and both disabled is a legal user
 * state that yields a silent voice rather than an error.
 */

import { CHOKE_STOP_RAMP_SECONDS } from '../constants.js';
import { PlaybackError } from '../errors.js';
import type { InstrumentDefinition, PercussionInstrumentDefinition } from '../types/instrument.js';
import { clamp, midiNoteToFrequencyHz, velocityToGain } from './conversions.js';
import type { AdsrSettings } from './envelope.js';
import { applyAttackDecaySustain, applyRelease, MIN_ENVELOPE_RAMP_SECONDS } from './envelope.js';
import { getWhiteNoiseBuffer } from './noise-buffer.js';
import type { Voice, VoiceFactory, VoicePriority, VoiceStartRequest } from './voice.js';

/** Sources are stopped this far past the envelope tail, so the ramp to zero always completes. */
const SOURCE_TAIL_MARGIN_SECONDS = 0.01;

/** `exponentialRampToValueAtTime` throws on a zero or negative target, so the sweep floors here. */
const MIN_SWEEP_TARGET_HZ = 1;

/**
 * A tracked frequency is derived, not stored, so it is not bound by the editable ranges on
 * `PercussionInstrumentDefinition` — only by what an oscillator and a filter can usefully do.
 */
const MIN_TRACKED_HZ = 1;
const MAX_TRACKED_HZ = 20_000;

/**
 * How far a tracking layer is transposed by the note that triggered it: the interval from
 * `rootMidiNote`, as a frequency ratio. At the root note this is exactly 1, so a preset sounds
 * identical whether or not tracking is on — which is what makes the option safe to leave enabled.
 */
function noteTrackingRatio(midiNote: number, rootMidiNote: number): number {
	return midiNoteToFrequencyHz(midiNote) / midiNoteToFrequencyHz(rootMidiNote);
}

function trackedFrequencyHz(designedHz: number, ratio: number): number {
	return clamp(designedHz * ratio, MIN_TRACKED_HZ, MAX_TRACKED_HZ);
}

interface PercussionLayer {
	readonly source: AudioScheduledSourceNode;
	readonly envelopeGain: GainNode;
	readonly layerGain: GainNode;
	readonly settings: AdsrSettings;
	readonly peakValue: number;
	readonly attackEndSeconds: number;
	/** Where this layer's release starts unless something asks for an earlier one. */
	readonly naturalReleaseAtSeconds: number;
	tailEndSeconds: number;
}

class PercussionVoiceImpl implements Voice {
	readonly channelId: string;
	readonly midiNote: number;
	readonly startedAtSeconds: number;
	readonly priority: VoicePriority;

	private readonly layers: PercussionLayer[] = [];
	private readonly createdNodes: AudioNode[] = [];

	/** The latest time any layer has been scheduled to begin releasing; a release never moves later. */
	private releaseBoundSeconds = Infinity;
	private releasing = false;
	private pendingSourceCount = 0;
	private ended = false;
	private endedListeners: Array<() => void> = [];

	constructor(request: VoiceStartRequest, instrument: PercussionInstrumentDefinition) {
		const { context, destination, startAtSeconds } = request;

		this.channelId = request.channelId;
		// By default the note number selects nothing — a percussion channel plays one designed sound,
		// and this surprises people. It only reaches the audio graph through the per-layer tracking
		// switches below. Velocity always scales the hit, through each layer's envelope peak.
		this.midiNote = request.midiNote;
		this.startedAtSeconds = startAtSeconds;
		this.priority = request.priority ?? 'normal';

		const peakValue = velocityToGain(request.velocity);
		const trackingRatio = noteTrackingRatio(request.midiNote, instrument.rootMidiNote);

		const oscillatorLayer = instrument.oscillatorLayer;
		if (oscillatorLayer.enabled) {
			// Both ends of the sweep move together, so a tracked hit keeps the designed pitch drop.
			const ratio = oscillatorLayer.pitchTracksNote ? trackingRatio : 1;
			const startFrequencyHz = trackedFrequencyHz(oscillatorLayer.startFrequencyHz, ratio);
			const endFrequencyHz = trackedFrequencyHz(oscillatorLayer.endFrequencyHz, ratio);

			const oscillator = context.createOscillator();
			// The four allowed waveforms are exactly the native OscillatorType values.
			oscillator.type = oscillatorLayer.waveform;
			oscillator.frequency.setValueAtTime(startFrequencyHz, startAtSeconds);
			if (endFrequencyHz !== startFrequencyHz) {
				// Exponential rather than linear because that is what reads as one falling pitch.
				oscillator.frequency.exponentialRampToValueAtTime(
					Math.max(endFrequencyHz, MIN_SWEEP_TARGET_HZ),
					startAtSeconds + oscillatorLayer.pitchDecaySeconds
				);
			}
			this.buildLayer({
				context,
				destination,
				startAtSeconds,
				peakValue,
				source: oscillator,
				chainOutput: oscillator,
				settings: oscillatorLayer,
				layerGainValue: oscillatorLayer.gain
			});
		}

		const noiseLayer = instrument.noiseLayer;
		if (noiseLayer.enabled) {
			const noiseSource = context.createBufferSource();
			noiseSource.buffer = getWhiteNoiseBuffer(context);
			// The buffer outlasts every percussion decay, so a loop would only ever be dead weight.
			noiseSource.loop = false;
			// Unlike the pitched voice's optional filter, this one is not optional: raw white noise is
			// never the intent, so an enabled noise layer always gets its filter.
			const filter = context.createBiquadFilter();
			filter.type = noiseLayer.filterType;
			// White noise has no pitch to transpose, so the cutoff is what tracks the note here.
			filter.frequency.setValueAtTime(
				trackedFrequencyHz(
					noiseLayer.filterFrequencyHz,
					noiseLayer.filterTracksNote ? trackingRatio : 1
				),
				startAtSeconds
			);
			filter.Q.setValueAtTime(noiseLayer.filterQ, startAtSeconds);
			noiseSource.connect(filter);
			this.createdNodes.push(filter);
			this.buildLayer({
				context,
				destination,
				startAtSeconds,
				peakValue,
				source: noiseSource,
				chainOutput: filter,
				settings: noiseLayer,
				layerGainValue: noiseLayer.gain
			});
		}

		if (this.layers.length === 0) {
			// Disabling both layers is a legal user state, so this must not throw. The voice creates
			// nothing and reports its end on the next microtask, which is late enough for the manager
			// to have registered its listener and early enough that the slot is never held.
			queueMicrotask(() => {
				this.handleEnded();
			});
			return;
		}

		this.scheduleRelease(request.releaseAtSeconds);
	}

	get isReleasing(): boolean {
		return this.releasing;
	}

	release(atSeconds: number): void {
		// A one-shot hit is already heading for its own tail; a release only ever pulls it forward.
		if (this.ended || atSeconds >= this.releaseBoundSeconds) return;
		this.scheduleRelease(atSeconds);
	}

	stop(atSeconds: number): void {
		if (this.ended || this.layers.length === 0) return;

		this.releaseBoundSeconds = atSeconds;
		this.releasing = true;
		for (const layer of this.layers) {
			// The cut is taken on the layer gain rather than the envelope gain, so a choked hit loses
			// both layers together no matter where each envelope had got to.
			const gain = layer.layerGain.gain;
			const currentValue = gain.value;
			gain.cancelScheduledValues(atSeconds);
			gain.setValueAtTime(currentValue, atSeconds);
			gain.linearRampToValueAtTime(0, atSeconds + CHOKE_STOP_RAMP_SECONDS);
			layer.tailEndSeconds = atSeconds + CHOKE_STOP_RAMP_SECONDS;
		}
		const stopAtSeconds = atSeconds + CHOKE_STOP_RAMP_SECONDS + MIN_ENVELOPE_RAMP_SECONDS;
		for (const layer of this.layers) layer.source.stop(stopAtSeconds);
	}

	onEnded(listener: () => void): void {
		this.endedListeners.push(listener);
	}

	dispose(): void {
		this.endedListeners = [];
		for (const layer of this.layers) layer.source.onended = null;
		this.disconnectNodes();
	}

	private buildLayer(input: {
		context: BaseAudioContext;
		destination: AudioNode;
		startAtSeconds: number;
		peakValue: number;
		source: AudioScheduledSourceNode;
		/** Output of the layer's pre-envelope chain: the source itself, or the noise filter. */
		chainOutput: AudioNode;
		settings: AdsrSettings;
		layerGainValue: number;
	}): void {
		const { context, startAtSeconds, settings } = input;

		const envelopeGain = context.createGain();
		applyAttackDecaySustain({
			param: envelopeGain.gain,
			startAtSeconds,
			peakValue: input.peakValue,
			settings
		});

		// A constant gain of its own, deliberately not folded into the envelope peak: layer balance
		// is a timbral setting, so the UI must be able to change it without touching envelope math.
		const layerGain = context.createGain();
		layerGain.gain.setValueAtTime(input.layerGainValue, startAtSeconds);

		input.chainOutput.connect(envelopeGain);
		envelopeGain.connect(layerGain);
		layerGain.connect(input.destination);
		this.createdNodes.push(input.source, envelopeGain, layerGain);

		const attackEndSeconds =
			startAtSeconds + Math.max(settings.attackSeconds, MIN_ENVELOPE_RAMP_SECONDS);
		const naturalReleaseAtSeconds =
			attackEndSeconds + Math.max(settings.decaySeconds, MIN_ENVELOPE_RAMP_SECONDS);
		this.layers.push({
			source: input.source,
			envelopeGain,
			layerGain,
			settings,
			peakValue: input.peakValue,
			attackEndSeconds,
			naturalReleaseAtSeconds,
			tailEndSeconds: naturalReleaseAtSeconds
		});

		input.source.onended = (): void => {
			this.handleSourceEnded();
		};
		this.pendingSourceCount += 1;
		input.source.start(startAtSeconds);
	}

	/**
	 * A hit is one-shot: every layer releases at the end of its own decay however long the MIDI note
	 * is held, so `releaseBoundSeconds` can only ever cut a layer shorter, never extend it.
	 */
	private scheduleRelease(releaseBoundSeconds: number): void {
		let latestReleaseAtSeconds = this.startedAtSeconds;
		let tailEndSeconds = this.startedAtSeconds;

		for (const layer of this.layers) {
			const releaseAtSeconds = Math.min(layer.naturalReleaseAtSeconds, releaseBoundSeconds);
			layer.tailEndSeconds = applyRelease({
				param: layer.envelopeGain.gain,
				releaseAtSeconds,
				settings: layer.settings,
				fromValue: this.envelopeLevelAt(layer, releaseAtSeconds)
			});
			latestReleaseAtSeconds = Math.max(latestReleaseAtSeconds, releaseAtSeconds);
			tailEndSeconds = Math.max(tailEndSeconds, layer.tailEndSeconds);
		}

		this.releaseBoundSeconds = latestReleaseAtSeconds;
		this.releasing = true;
		// Both sources stop on the longer of the two tails; re-stopping is legal and the latest wins.
		const stopAtSeconds = tailEndSeconds + SOURCE_TAIL_MARGIN_SECONDS;
		for (const layer of this.layers) layer.source.stop(stopAtSeconds);
	}

	/**
	 * The level the attack/decay stage holds at `atSeconds`, computed rather than read from
	 * `param.value`: the whole envelope is scheduled up front, so a real `AudioParam` still reports
	 * its pre-attack value here (see `applyRelease`'s `fromValue`).
	 */
	private envelopeLevelAt(layer: PercussionLayer, atSeconds: number): number {
		const sustainValue = layer.peakValue * layer.settings.sustainLevel;
		if (atSeconds >= layer.naturalReleaseAtSeconds) return sustainValue;
		if (atSeconds <= this.startedAtSeconds) return 0;
		if (atSeconds <= layer.attackEndSeconds) {
			const attackProgress =
				(atSeconds - this.startedAtSeconds) / (layer.attackEndSeconds - this.startedAtSeconds);
			return layer.peakValue * attackProgress;
		}
		const decayProgress =
			(atSeconds - layer.attackEndSeconds) /
			(layer.naturalReleaseAtSeconds - layer.attackEndSeconds);
		return layer.peakValue + (sustainValue - layer.peakValue) * decayProgress;
	}

	/** Whichever source ends last ends the voice. */
	private handleSourceEnded(): void {
		this.pendingSourceCount -= 1;
		if (this.pendingSourceCount > 0) return;
		this.handleEnded();
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
		for (const node of this.createdNodes) node.disconnect();
		this.createdNodes.length = 0;
		this.layers.length = 0;
	}
}

/**
 * Choke groups are free text, compared with exact equality after trimming. An empty group is the
 * same as none — the schema already normalizes it to `null`, and this keeps a hand-built
 * instrument from creating a group that silently chokes every other ungrouped hit.
 */
export function resolveChokeGroup(instrument: InstrumentDefinition): string | null {
	if (instrument.kind !== 'percussion' || instrument.chokeGroup === null) return null;
	const trimmed = instrument.chokeGroup.trim();
	return trimmed === '' ? null : trimmed;
}

export function createPercussionVoiceFactory(): VoiceFactory {
	return {
		kind: 'percussion',
		create(request: VoiceStartRequest): Voice {
			if (request.instrument.kind !== 'percussion') {
				throw new PlaybackError(
					`createPercussionVoiceFactory: channel "${request.channelId}" supplied a ` +
						`"${request.instrument.kind}" instrument; the percussion factory only builds ` +
						`percussion voices.`
				);
			}
			return new PercussionVoiceImpl(request, request.instrument);
		}
	};
}
