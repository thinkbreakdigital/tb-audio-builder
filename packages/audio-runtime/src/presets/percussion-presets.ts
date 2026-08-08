/**
 * The seven built-in percussion sounds (kickoff §13, spec §4.3).
 *
 * Every one of them uses both layers: the designed sound is the *combination* of a pitched body and
 * a filtered noise transient, so a built-in that shipped with one layer off would teach the wrong
 * model of the instrument. Like the pitched table, these are templates — nothing here is ever
 * handed out by reference.
 */

import type { InstrumentDefinition, PercussionInstrumentDefinition } from '../types/instrument.js';
import type { BuiltInPreset } from './pitched-presets.js';

export const DEFAULT_PERCUSSION_PRESET_ID = 'kick';

/**
 * Middle C, the root every built-in is designed at. Note tracking is off across the library, so the
 * value is inert until a user turns it on — at which point middle C is the note that leaves the
 * preset sounding exactly as designed.
 */
export const DEFAULT_PERCUSSION_ROOT_MIDI_NOTE = 60;

interface PercussionPresetInput {
	id: string;
	name: string;
	oscillator: PercussionInstrumentDefinition['oscillatorLayer'];
	noise: PercussionInstrumentDefinition['noiseLayer'];
	chokeGroup: string | null;
}

function definePercussionPreset(input: PercussionPresetInput): BuiltInPreset {
	return {
		id: input.id,
		name: input.name,
		type: 'percussion',
		definition: {
			kind: 'percussion',
			presetId: input.id,
			oscillatorLayer: input.oscillator,
			noiseLayer: input.noise,
			rootMidiNote: DEFAULT_PERCUSSION_ROOT_MIDI_NOTE,
			chokeGroup: input.chokeGroup
		}
	};
}

// Both layers of every preset sustain at 0: a hit is one-shot, so the sustain stage has nothing to
// hold. It stays user-editable, which is why it is written out rather than defaulted away.
export const PERCUSSION_PRESETS: readonly BuiltInPreset[] = [
	definePercussionPreset({
		id: 'kick',
		name: 'Kick',
		oscillator: {
			enabled: true,
			pitchTracksNote: false,
			waveform: 'sine',
			startFrequencyHz: 150,
			endFrequencyHz: 45,
			pitchDecaySeconds: 0.06,
			attackSeconds: 0.001,
			decaySeconds: 0.28,
			sustainLevel: 0,
			releaseSeconds: 0.05,
			gain: 0.9
		},
		noise: {
			enabled: true,
			filterTracksNote: false,
			filterType: 'lowpass',
			filterFrequencyHz: 800,
			filterQ: 0.7,
			attackSeconds: 0.001,
			decaySeconds: 0.03,
			sustainLevel: 0,
			releaseSeconds: 0.02,
			gain: 0.25
		},
		chokeGroup: null
	}),
	definePercussionPreset({
		id: 'snare',
		name: 'Snare',
		oscillator: {
			enabled: true,
			pitchTracksNote: false,
			waveform: 'triangle',
			startFrequencyHz: 220,
			endFrequencyHz: 180,
			pitchDecaySeconds: 0.03,
			attackSeconds: 0.001,
			decaySeconds: 0.12,
			sustainLevel: 0,
			releaseSeconds: 0.05,
			gain: 0.5
		},
		noise: {
			enabled: true,
			filterTracksNote: false,
			filterType: 'bandpass',
			filterFrequencyHz: 1800,
			filterQ: 1.2,
			attackSeconds: 0.001,
			decaySeconds: 0.16,
			sustainLevel: 0,
			releaseSeconds: 0.08,
			gain: 0.8
		},
		chokeGroup: null
	}),
	definePercussionPreset({
		id: 'closed-hat',
		name: 'Closed Hi-Hat',
		oscillator: {
			enabled: true,
			pitchTracksNote: false,
			waveform: 'square',
			startFrequencyHz: 4000,
			endFrequencyHz: 3600,
			pitchDecaySeconds: 0.01,
			attackSeconds: 0.001,
			decaySeconds: 0.03,
			sustainLevel: 0,
			releaseSeconds: 0.02,
			gain: 0.25
		},
		noise: {
			enabled: true,
			filterTracksNote: false,
			filterType: 'highpass',
			filterFrequencyHz: 7000,
			filterQ: 0.9,
			attackSeconds: 0.001,
			decaySeconds: 0.04,
			sustainLevel: 0,
			releaseSeconds: 0.02,
			gain: 0.7
		},
		// The two hats share a group so a closed hat cuts a ringing open one, as a real pair does.
		chokeGroup: 'hats'
	}),
	definePercussionPreset({
		id: 'open-hat',
		name: 'Open Hi-Hat',
		oscillator: {
			enabled: true,
			pitchTracksNote: false,
			waveform: 'square',
			startFrequencyHz: 4000,
			endFrequencyHz: 3600,
			pitchDecaySeconds: 0.01,
			attackSeconds: 0.001,
			decaySeconds: 0.06,
			sustainLevel: 0,
			releaseSeconds: 0.04,
			gain: 0.25
		},
		noise: {
			enabled: true,
			filterTracksNote: false,
			filterType: 'highpass',
			filterFrequencyHz: 6500,
			filterQ: 0.9,
			attackSeconds: 0.002,
			decaySeconds: 0.35,
			sustainLevel: 0,
			releaseSeconds: 0.18,
			gain: 0.7
		},
		chokeGroup: 'hats'
	}),
	definePercussionPreset({
		id: 'tom',
		name: 'Tom',
		oscillator: {
			enabled: true,
			pitchTracksNote: false,
			waveform: 'sine',
			startFrequencyHz: 260,
			endFrequencyHz: 110,
			pitchDecaySeconds: 0.1,
			attackSeconds: 0.001,
			decaySeconds: 0.3,
			sustainLevel: 0,
			releaseSeconds: 0.08,
			gain: 0.85
		},
		noise: {
			enabled: true,
			filterTracksNote: false,
			filterType: 'lowpass',
			filterFrequencyHz: 1500,
			filterQ: 0.7,
			attackSeconds: 0.001,
			decaySeconds: 0.03,
			sustainLevel: 0,
			releaseSeconds: 0.02,
			gain: 0.15
		},
		chokeGroup: null
	}),
	definePercussionPreset({
		id: 'click',
		name: 'Click',
		oscillator: {
			enabled: true,
			pitchTracksNote: false,
			waveform: 'sine',
			startFrequencyHz: 2200,
			endFrequencyHz: 1800,
			pitchDecaySeconds: 0.005,
			attackSeconds: 0.001,
			decaySeconds: 0.015,
			sustainLevel: 0,
			releaseSeconds: 0.01,
			gain: 0.6
		},
		noise: {
			enabled: true,
			filterTracksNote: false,
			filterType: 'highpass',
			filterFrequencyHz: 4000,
			filterQ: 0.7,
			attackSeconds: 0.001,
			decaySeconds: 0.008,
			sustainLevel: 0,
			releaseSeconds: 0.005,
			gain: 0.5
		},
		chokeGroup: null
	}),
	definePercussionPreset({
		id: 'warning-hit',
		name: 'Warning Hit',
		oscillator: {
			enabled: true,
			pitchTracksNote: false,
			waveform: 'sawtooth',
			startFrequencyHz: 900,
			endFrequencyHz: 180,
			pitchDecaySeconds: 0.18,
			attackSeconds: 0.002,
			decaySeconds: 0.4,
			sustainLevel: 0,
			releaseSeconds: 0.15,
			gain: 0.7
		},
		noise: {
			enabled: true,
			filterTracksNote: false,
			filterType: 'bandpass',
			filterFrequencyHz: 2400,
			filterQ: 6,
			attackSeconds: 0.002,
			decaySeconds: 0.3,
			sustainLevel: 0,
			releaseSeconds: 0.12,
			gain: 0.5
		},
		chokeGroup: null
	})
];

export function getPercussionPreset(id: string): BuiltInPreset {
	const preset = PERCUSSION_PRESETS.find((candidate) => candidate.id === id);
	if (preset === undefined) {
		throw new Error(
			`Unknown percussion preset "${id}". Available ids: ` +
				`${PERCUSSION_PRESETS.map((candidate) => candidate.id).join(', ')}.`
		);
	}
	return preset;
}

/** A fresh object every call — the preset table is a template, never a shared reference. */
export function createDefaultPercussionInstrument(): PercussionInstrumentDefinition {
	return clonePercussionDefinition(getPercussionPreset(DEFAULT_PERCUSSION_PRESET_ID).definition);
}

function clonePercussionDefinition(
	definition: InstrumentDefinition
): PercussionInstrumentDefinition {
	if (definition.kind !== 'percussion') {
		throw new Error(
			`Preset "${DEFAULT_PERCUSSION_PRESET_ID}" is not a percussion instrument; ` +
				`got "${definition.kind}".`
		);
	}
	return {
		kind: 'percussion',
		presetId: definition.presetId,
		oscillatorLayer: { ...definition.oscillatorLayer },
		noiseLayer: { ...definition.noiseLayer },
		rootMidiNote: definition.rootMidiNote,
		chokeGroup: definition.chokeGroup
	};
}

/**
 * Ordered longest-match-first where names overlap: `openhat` must be tested before `hat`, or every
 * open hi-hat track in the world would import as a closed one.
 */
const PRESET_ID_BY_NAME_FRAGMENT: readonly (readonly [string, string])[] = [
	['kick', 'kick'],
	['snare', 'snare'],
	['openhat', 'open-hat'],
	['ohat', 'open-hat'],
	['hihat', 'closed-hat'],
	['closed', 'closed-hat'],
	['hat', 'closed-hat'],
	['tom', 'tom'],
	['click', 'click'],
	['rim', 'click'],
	['warn', 'warning-hit'],
	['alarm', 'warning-hit'],
	['alert', 'warning-hit']
];

/**
 * Best-effort mapping from a MIDI track name to a built-in, used by the channel assignment UI in
 * phase 09. Separators are dropped so `NOISE_KICK`, `noise kick`, and `Noise-Kick` all match.
 */
export function suggestPercussionPresetId(channelName: string): string {
	const normalized = channelName.toLowerCase().replace(/[^a-z0-9]/g, '');
	for (const [fragment, presetId] of PRESET_ID_BY_NAME_FRAGMENT) {
		if (normalized.includes(fragment)) return presetId;
	}
	return DEFAULT_PERCUSSION_PRESET_ID;
}
