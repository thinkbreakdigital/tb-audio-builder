import { PercussionInstrumentDefinitionSchema } from '@thinkbreak/project-schema';
import { describe, expect, it } from 'vitest';
import {
	createDefaultPercussionInstrument,
	DEFAULT_PERCUSSION_PRESET_ID,
	DEFAULT_PERCUSSION_ROOT_MIDI_NOTE,
	getPercussionPreset,
	PERCUSSION_PRESETS,
	suggestPercussionPresetId
} from '../src/presets/percussion-presets.js';
import type { PercussionInstrumentDefinition } from '../src/types/instrument.js';

/** The phase 08 tables, transcribed independently of the implementation. */
const EXPECTED = [
	{
		id: 'kick',
		name: 'Kick',
		// waveform, startHz, endHz, pitchDecay, attack, decay, sustain, release, gain
		oscillator: ['sine', 150, 45, 0.06, 0.001, 0.28, 0, 0.05, 0.9],
		// filter, freqHz, Q, attack, decay, sustain, release, gain
		noise: ['lowpass', 800, 0.7, 0.001, 0.03, 0, 0.02, 0.25],
		chokeGroup: null
	},
	{
		id: 'snare',
		name: 'Snare',
		oscillator: ['triangle', 220, 180, 0.03, 0.001, 0.12, 0, 0.05, 0.5],
		noise: ['bandpass', 1800, 1.2, 0.001, 0.16, 0, 0.08, 0.8],
		chokeGroup: null
	},
	{
		id: 'closed-hat',
		name: 'Closed Hi-Hat',
		oscillator: ['square', 4000, 3600, 0.01, 0.001, 0.03, 0, 0.02, 0.25],
		noise: ['highpass', 7000, 0.9, 0.001, 0.04, 0, 0.02, 0.7],
		chokeGroup: 'hats'
	},
	{
		id: 'open-hat',
		name: 'Open Hi-Hat',
		oscillator: ['square', 4000, 3600, 0.01, 0.001, 0.06, 0, 0.04, 0.25],
		noise: ['highpass', 6500, 0.9, 0.002, 0.35, 0, 0.18, 0.7],
		chokeGroup: 'hats'
	},
	{
		id: 'tom',
		name: 'Tom',
		oscillator: ['sine', 260, 110, 0.1, 0.001, 0.3, 0, 0.08, 0.85],
		noise: ['lowpass', 1500, 0.7, 0.001, 0.03, 0, 0.02, 0.15],
		chokeGroup: null
	},
	{
		id: 'click',
		name: 'Click',
		oscillator: ['sine', 2200, 1800, 0.005, 0.001, 0.015, 0, 0.01, 0.6],
		noise: ['highpass', 4000, 0.7, 0.001, 0.008, 0, 0.005, 0.5],
		chokeGroup: null
	},
	{
		id: 'warning-hit',
		name: 'Warning Hit',
		oscillator: ['sawtooth', 900, 180, 0.18, 0.002, 0.4, 0, 0.15, 0.7],
		noise: ['bandpass', 2400, 6, 0.002, 0.3, 0, 0.12, 0.5],
		chokeGroup: null
	}
] as const;

function percussionDefinitionOf(id: string): PercussionInstrumentDefinition {
	const definition = getPercussionPreset(id).definition;
	if (definition.kind !== 'percussion') {
		throw new Error(`Preset "${id}" is not percussion.`);
	}
	return definition;
}

describe('PERCUSSION_PRESETS', () => {
	it('contains the seven required presets in the documented order', () => {
		expect(PERCUSSION_PRESETS.map((preset) => preset.id)).toEqual(EXPECTED.map((row) => row.id));
	});

	it.each(EXPECTED)('$id matches the specification tables exactly', (row) => {
		const preset = getPercussionPreset(row.id);
		const definition = percussionDefinitionOf(row.id);

		expect(preset.name).toBe(row.name);
		expect(preset.type).toBe('percussion');
		expect(definition.presetId).toBe(row.id);
		expect(definition.oscillatorLayer).toEqual({
			enabled: true,
			pitchTracksNote: false,
			waveform: row.oscillator[0],
			startFrequencyHz: row.oscillator[1],
			endFrequencyHz: row.oscillator[2],
			pitchDecaySeconds: row.oscillator[3],
			attackSeconds: row.oscillator[4],
			decaySeconds: row.oscillator[5],
			sustainLevel: row.oscillator[6],
			releaseSeconds: row.oscillator[7],
			gain: row.oscillator[8]
		});
		expect(definition.noiseLayer).toEqual({
			enabled: true,
			filterTracksNote: false,
			filterType: row.noise[0],
			filterFrequencyHz: row.noise[1],
			filterQ: row.noise[2],
			attackSeconds: row.noise[3],
			decaySeconds: row.noise[4],
			sustainLevel: row.noise[5],
			releaseSeconds: row.noise[6],
			gain: row.noise[7]
		});
		expect(definition.rootMidiNote).toBe(DEFAULT_PERCUSSION_ROOT_MIDI_NOTE);
		expect(definition.chokeGroup).toBe(row.chokeGroup);
	});

	it('ships every preset with note tracking off, anchored at middle C', () => {
		// The library is a drum kit first: one designed sound per channel, note number ignored.
		// Tracking is opt-in per layer, and middle C is where a tracked preset sounds as designed.
		expect(DEFAULT_PERCUSSION_ROOT_MIDI_NOTE).toBe(60);
		for (const preset of PERCUSSION_PRESETS) {
			const definition = percussionDefinitionOf(preset.id);
			expect(definition.oscillatorLayer.pitchTracksNote).toBe(false);
			expect(definition.noiseLayer.filterTracksNote).toBe(false);
			expect(definition.rootMidiNote).toBe(60);
		}
	});

	it('enables both layers on every preset', () => {
		for (const preset of PERCUSSION_PRESETS) {
			const definition = percussionDefinitionOf(preset.id);
			expect(definition.oscillatorLayer.enabled).toBe(true);
			expect(definition.noiseLayer.enabled).toBe(true);
		}
	});

	it('sustains at zero on both layers — a hit is one-shot', () => {
		for (const preset of PERCUSSION_PRESETS) {
			const definition = percussionDefinitionOf(preset.id);
			expect(definition.oscillatorLayer.sustainLevel).toBe(0);
			expect(definition.noiseLayer.sustainLevel).toBe(0);
		}
	});

	it('puts both hi-hats, and only the hi-hats, in one choke group', () => {
		const grouped = PERCUSSION_PRESETS.filter(
			(preset) => percussionDefinitionOf(preset.id).chokeGroup !== null
		);

		expect(grouped.map((preset) => preset.id)).toEqual(['closed-hat', 'open-hat']);
		expect(new Set(grouped.map((preset) => percussionDefinitionOf(preset.id).chokeGroup))).toEqual(
			new Set(['hats'])
		);
	});

	it('validates every definition against the published Zod schema', () => {
		// Imported here and nowhere in src/: audio-runtime ships with zero runtime dependencies.
		for (const preset of PERCUSSION_PRESETS) {
			expect(PercussionInstrumentDefinitionSchema.safeParse(preset.definition).success).toBe(true);
		}
	});
});

describe('getPercussionPreset', () => {
	it('throws with the offending id in the message', () => {
		expect(() => getPercussionPreset('nope')).toThrow(/"nope"/);
	});
});

describe('createDefaultPercussionInstrument', () => {
	it('returns kick as a fresh object every call', () => {
		const first = createDefaultPercussionInstrument();
		const second = createDefaultPercussionInstrument();

		expect(DEFAULT_PERCUSSION_PRESET_ID).toBe('kick');
		expect(first).toEqual(percussionDefinitionOf('kick'));
		expect(first).not.toBe(second);
		expect(first.oscillatorLayer).not.toBe(second.oscillatorLayer);
		expect(first.noiseLayer).not.toBe(second.noiseLayer);
	});

	it('does not leak mutations back into the preset table', () => {
		const instrument = createDefaultPercussionInstrument();

		instrument.oscillatorLayer.startFrequencyHz = 20;
		instrument.noiseLayer.enabled = false;
		instrument.chokeGroup = 'hats';

		const preset = percussionDefinitionOf('kick');
		expect(preset.oscillatorLayer.startFrequencyHz).toBe(150);
		expect(preset.noiseLayer.enabled).toBe(true);
		expect(preset.chokeGroup).toBeNull();
	});
});

describe('suggestPercussionPresetId', () => {
	it.each([
		['NOISE_KICK', 'kick'],
		['NOISE_SNARE', 'snare'],
		['NOISE_HAT', 'closed-hat'],
		['OPEN HAT', 'open-hat'],
		['Tom 2', 'tom'],
		['o-hat', 'open-hat'],
		['Closed Hi-Hat', 'closed-hat'],
		['Rim shot', 'click'],
		['ALERT', 'warning-hit'],
		['Track 3', 'kick']
	])('maps %s to %s', (channelName, expected) => {
		expect(suggestPercussionPresetId(channelName)).toBe(expected);
	});

	it('matches an open hat before a plain hat, whatever the separators', () => {
		for (const name of ['openhat', 'OPEN_HAT', 'Open-Hat 1', 'ohat']) {
			expect(suggestPercussionPresetId(name)).toBe('open-hat');
		}
	});
});
