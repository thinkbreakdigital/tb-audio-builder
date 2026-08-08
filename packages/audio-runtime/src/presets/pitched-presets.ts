/**
 * The seven built-in pitched sounds (kickoff §11, spec §4.5).
 *
 * These are templates. Nothing here is ever handed out by reference — `createDefaultPitchedInstrument`
 * and every consumer clone first, because a preset mutated through one channel would silently change
 * every other channel that started from it.
 */

import type { InstrumentDefinition, PitchedInstrumentDefinition } from '../types/instrument.js';

export interface BuiltInPreset {
	id: string; // stable slug; becomes InstrumentPresetSchema.id
	name: string;
	type: 'pitched' | 'percussion';
	definition: InstrumentDefinition;
}

export const DEFAULT_PITCHED_PRESET_ID = 'square-lead';

interface PitchedPresetInput {
	id: string;
	name: string;
	waveform: PitchedInstrumentDefinition['oscillator']['waveform'];
	octaveOffset: number;
	semitoneOffset: number;
	attackSeconds: number;
	decaySeconds: number;
	sustainLevel: number;
	releaseSeconds: number;
	filterEnabled: boolean;
	filterFrequencyHz: number;
	filterQ: number;
	vibratoEnabled: boolean;
	vibratoRateHz: number;
	vibratoDepthCents: number;
	pitchBendRangeSemitones: number;
	polyphonic: boolean;
	maxVoices: number;
}

/** Fields the table does not vary take the type's documented default. */
function definePitchedPreset(input: PitchedPresetInput): BuiltInPreset {
	return {
		id: input.id,
		name: input.name,
		type: 'pitched',
		definition: {
			kind: 'pitched',
			presetId: input.id,
			oscillator: {
				waveform: input.waveform,
				octaveOffset: input.octaveOffset,
				semitoneOffset: input.semitoneOffset,
				fineDetuneCents: 0
			},
			amplitudeEnvelope: {
				attackSeconds: input.attackSeconds,
				decaySeconds: input.decaySeconds,
				sustainLevel: input.sustainLevel,
				releaseSeconds: input.releaseSeconds
			},
			filter: {
				enabled: input.filterEnabled,
				// Every built-in shapes its tone by rolling off the top of a bright waveform.
				type: 'lowpass',
				frequencyHz: input.filterFrequencyHz,
				q: input.filterQ
			},
			modulation: {
				vibratoEnabled: input.vibratoEnabled,
				vibratoRateHz: input.vibratoRateHz,
				vibratoDepthCents: input.vibratoDepthCents,
				pitchBendRangeSemitones: input.pitchBendRangeSemitones
			},
			voice: {
				polyphonic: input.polyphonic,
				maxVoices: input.maxVoices,
				stealMode: 'oldest'
			}
		}
	};
}

export const PITCHED_PRESETS: readonly BuiltInPreset[] = [
	definePitchedPreset({
		id: 'square-lead',
		name: 'Square Lead',
		waveform: 'square',
		octaveOffset: 0,
		semitoneOffset: 0,
		attackSeconds: 0.005,
		decaySeconds: 0.06,
		sustainLevel: 0.75,
		releaseSeconds: 0.12,
		filterEnabled: true,
		filterFrequencyHz: 5000,
		filterQ: 0.8,
		vibratoEnabled: true,
		vibratoRateHz: 5.5,
		vibratoDepthCents: 12,
		pitchBendRangeSemitones: 2,
		polyphonic: false,
		maxVoices: 1
	}),
	definePitchedPreset({
		id: 'square-harmony',
		name: 'Square Harmony',
		waveform: 'square',
		octaveOffset: 0,
		semitoneOffset: 0,
		attackSeconds: 0.008,
		decaySeconds: 0.1,
		sustainLevel: 0.6,
		releaseSeconds: 0.18,
		filterEnabled: true,
		filterFrequencyHz: 3500,
		filterQ: 0.7,
		vibratoEnabled: false,
		vibratoRateHz: 5,
		vibratoDepthCents: 6,
		pitchBendRangeSemitones: 2,
		polyphonic: true,
		maxVoices: 4
	}),
	definePitchedPreset({
		id: 'square-arpeggio',
		name: 'Square Arpeggio',
		waveform: 'square',
		octaveOffset: 1,
		semitoneOffset: 0,
		attackSeconds: 0.002,
		decaySeconds: 0.05,
		// A zero sustain makes this a plucked shape rather than a held tone.
		sustainLevel: 0,
		releaseSeconds: 0.06,
		filterEnabled: true,
		filterFrequencyHz: 6000,
		filterQ: 0.9,
		vibratoEnabled: false,
		vibratoRateHz: 5,
		vibratoDepthCents: 0,
		pitchBendRangeSemitones: 2,
		polyphonic: true,
		maxVoices: 4
	}),
	definePitchedPreset({
		id: 'triangle-bass',
		name: 'Triangle Bass',
		waveform: 'triangle',
		octaveOffset: -1,
		semitoneOffset: 0,
		attackSeconds: 0.004,
		decaySeconds: 0.12,
		sustainLevel: 0.8,
		releaseSeconds: 0.15,
		filterEnabled: true,
		filterFrequencyHz: 1200,
		filterQ: 0.7,
		vibratoEnabled: false,
		vibratoRateHz: 4,
		vibratoDepthCents: 0,
		pitchBendRangeSemitones: 2,
		polyphonic: false,
		maxVoices: 1
	}),
	definePitchedPreset({
		id: 'saw-signal-lead',
		name: 'Saw Signal Lead',
		waveform: 'sawtooth',
		octaveOffset: 0,
		semitoneOffset: 0,
		attackSeconds: 0.006,
		decaySeconds: 0.09,
		sustainLevel: 0.7,
		releaseSeconds: 0.2,
		filterEnabled: true,
		filterFrequencyHz: 3000,
		filterQ: 2.5,
		vibratoEnabled: true,
		vibratoRateHz: 6,
		vibratoDepthCents: 16,
		pitchBendRangeSemitones: 2,
		polyphonic: false,
		maxVoices: 1
	}),
	definePitchedPreset({
		id: 'filtered-drone',
		name: 'Filtered Drone',
		waveform: 'sawtooth',
		octaveOffset: -1,
		semitoneOffset: 0,
		// Attack 0.60 and sustain 0.85 resolve this to `low` priority (voice-priority.ts), which caps
		// the channel at `maxDroneVoices` — the 2 recorded below.
		attackSeconds: 0.6,
		decaySeconds: 0.8,
		sustainLevel: 0.85,
		releaseSeconds: 1.2,
		filterEnabled: true,
		filterFrequencyHz: 800,
		filterQ: 1.8,
		vibratoEnabled: true,
		vibratoRateHz: 0.4,
		vibratoDepthCents: 8,
		pitchBendRangeSemitones: 2,
		polyphonic: true,
		maxVoices: 2
	}),
	definePitchedPreset({
		id: 'soft-sine-lead',
		name: 'Soft Sine Lead',
		waveform: 'sine',
		octaveOffset: 0,
		semitoneOffset: 0,
		attackSeconds: 0.01,
		decaySeconds: 0.15,
		sustainLevel: 0.7,
		releaseSeconds: 0.25,
		// A sine has no harmonics to remove, so the filter is off and its values are inert.
		filterEnabled: false,
		filterFrequencyHz: 20000,
		filterQ: 0.7,
		vibratoEnabled: true,
		vibratoRateHz: 5,
		vibratoDepthCents: 10,
		pitchBendRangeSemitones: 2,
		polyphonic: true,
		maxVoices: 4
	})
];

export function getPitchedPreset(id: string): BuiltInPreset {
	const preset = PITCHED_PRESETS.find((candidate) => candidate.id === id);
	if (preset === undefined) {
		throw new Error(
			`Unknown pitched preset "${id}". Available ids: ` +
				`${PITCHED_PRESETS.map((candidate) => candidate.id).join(', ')}.`
		);
	}
	return preset;
}

/** A fresh object every call — the preset table is a template, never a shared reference. */
export function createDefaultPitchedInstrument(): PitchedInstrumentDefinition {
	const definition = getPitchedPreset(DEFAULT_PITCHED_PRESET_ID).definition;
	if (definition.kind !== 'pitched') {
		throw new Error(
			`Preset "${DEFAULT_PITCHED_PRESET_ID}" is not a pitched instrument; got "${definition.kind}".`
		);
	}
	return {
		kind: 'pitched',
		presetId: definition.presetId,
		oscillator: { ...definition.oscillator },
		amplitudeEnvelope: { ...definition.amplitudeEnvelope },
		filter: { ...definition.filter },
		modulation: { ...definition.modulation },
		voice: { ...definition.voice }
	};
}
