import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_LIMITS } from '../src/constants.js';
import {
	createDefaultPitchedInstrument,
	DEFAULT_PITCHED_PRESET_ID,
	getPitchedPreset,
	PITCHED_PRESETS
} from '../src/presets/pitched-presets.js';
import { resolveMaxVoicesForChannel, resolveVoicePriority } from '../src/synth/voice-priority.js';
import type { PitchedInstrumentDefinition } from '../src/types/instrument.js';

/** The phase 07 table, transcribed independently of the implementation. */
const EXPECTED = [
	{
		id: 'square-lead',
		name: 'Square Lead',
		waveform: 'square',
		octaveOffset: 0,
		semitoneOffset: 0,
		envelope: [0.005, 0.06, 0.75, 0.12],
		filter: [true, 5000, 0.8],
		vibrato: [true, 5.5, 12],
		pitchBendRangeSemitones: 2,
		polyphonic: false,
		maxVoices: 1
	},
	{
		id: 'square-harmony',
		name: 'Square Harmony',
		waveform: 'square',
		octaveOffset: 0,
		semitoneOffset: 0,
		envelope: [0.008, 0.1, 0.6, 0.18],
		filter: [true, 3500, 0.7],
		vibrato: [false, 5, 6],
		pitchBendRangeSemitones: 2,
		polyphonic: true,
		maxVoices: 4
	},
	{
		id: 'square-arpeggio',
		name: 'Square Arpeggio',
		waveform: 'square',
		octaveOffset: 1,
		semitoneOffset: 0,
		envelope: [0.002, 0.05, 0, 0.06],
		filter: [true, 6000, 0.9],
		vibrato: [false, 5, 0],
		pitchBendRangeSemitones: 2,
		polyphonic: true,
		maxVoices: 4
	},
	{
		id: 'triangle-bass',
		name: 'Triangle Bass',
		waveform: 'triangle',
		octaveOffset: -1,
		semitoneOffset: 0,
		envelope: [0.004, 0.12, 0.8, 0.15],
		filter: [true, 1200, 0.7],
		vibrato: [false, 4, 0],
		pitchBendRangeSemitones: 2,
		polyphonic: false,
		maxVoices: 1
	},
	{
		id: 'saw-signal-lead',
		name: 'Saw Signal Lead',
		waveform: 'sawtooth',
		octaveOffset: 0,
		semitoneOffset: 0,
		envelope: [0.006, 0.09, 0.7, 0.2],
		filter: [true, 3000, 2.5],
		vibrato: [true, 6, 16],
		pitchBendRangeSemitones: 2,
		polyphonic: false,
		maxVoices: 1
	},
	{
		id: 'filtered-drone',
		name: 'Filtered Drone',
		waveform: 'sawtooth',
		octaveOffset: -1,
		semitoneOffset: 0,
		envelope: [0.6, 0.8, 0.85, 1.2],
		filter: [true, 800, 1.8],
		vibrato: [true, 0.4, 8],
		pitchBendRangeSemitones: 2,
		polyphonic: true,
		maxVoices: 2
	},
	{
		id: 'soft-sine-lead',
		name: 'Soft Sine Lead',
		waveform: 'sine',
		octaveOffset: 0,
		semitoneOffset: 0,
		envelope: [0.01, 0.15, 0.7, 0.25],
		filter: [false, 20000, 0.7],
		vibrato: [true, 5, 10],
		pitchBendRangeSemitones: 2,
		polyphonic: true,
		maxVoices: 4
	}
] as const;

function pitchedDefinitionOf(id: string): PitchedInstrumentDefinition {
	const definition = getPitchedPreset(id).definition;
	if (definition.kind !== 'pitched') {
		throw new Error(`Preset "${id}" is not pitched.`);
	}
	return definition;
}

describe('PITCHED_PRESETS', () => {
	it('contains the seven required presets in the documented order', () => {
		expect(PITCHED_PRESETS.map((preset) => preset.id)).toEqual(EXPECTED.map((row) => row.id));
	});

	it.each(EXPECTED)('$id matches the specification table exactly', (row) => {
		const preset = getPitchedPreset(row.id);
		const definition = pitchedDefinitionOf(row.id);

		expect(preset.name).toBe(row.name);
		expect(preset.type).toBe('pitched');
		expect(definition.presetId).toBe(row.id);
		expect(definition.oscillator).toEqual({
			waveform: row.waveform,
			octaveOffset: row.octaveOffset,
			semitoneOffset: row.semitoneOffset,
			fineDetuneCents: 0
		});
		expect(definition.amplitudeEnvelope).toEqual({
			attackSeconds: row.envelope[0],
			decaySeconds: row.envelope[1],
			sustainLevel: row.envelope[2],
			releaseSeconds: row.envelope[3]
		});
		expect(definition.filter).toEqual({
			enabled: row.filter[0],
			type: 'lowpass',
			frequencyHz: row.filter[1],
			q: row.filter[2]
		});
		expect(definition.modulation).toEqual({
			vibratoEnabled: row.vibrato[0],
			vibratoRateHz: row.vibrato[1],
			vibratoDepthCents: row.vibrato[2],
			pitchBendRangeSemitones: row.pitchBendRangeSemitones
		});
		expect(definition.voice).toEqual({
			polyphonic: row.polyphonic,
			maxVoices: row.maxVoices,
			stealMode: 'oldest'
		});
	});
});

describe('getPitchedPreset', () => {
	it('throws with the offending id in the message', () => {
		expect(() => getPitchedPreset('nope')).toThrow(/"nope"/);
	});
});

describe('createDefaultPitchedInstrument', () => {
	it('returns square-lead as a fresh object every call', () => {
		const first = createDefaultPitchedInstrument();
		const second = createDefaultPitchedInstrument();

		expect(DEFAULT_PITCHED_PRESET_ID).toBe('square-lead');
		expect(first).toEqual(pitchedDefinitionOf('square-lead'));
		expect(first).not.toBe(second);
		expect(first.oscillator).not.toBe(second.oscillator);
	});

	it('does not leak mutations back into the preset table', () => {
		const instrument = createDefaultPitchedInstrument();

		instrument.oscillator.waveform = 'sine';
		instrument.amplitudeEnvelope.sustainLevel = 0;
		instrument.voice.maxVoices = 8;

		const preset = pitchedDefinitionOf('square-lead');
		expect(preset.oscillator.waveform).toBe('square');
		expect(preset.amplitudeEnvelope.sustainLevel).toBe(0.75);
		expect(preset.voice.maxVoices).toBe(1);
		expect(createDefaultPitchedInstrument().oscillator.waveform).toBe('square');
	});
});

describe('voice priority across the preset library', () => {
	it('marks only filtered-drone as low priority', () => {
		const lowPriorityIds = PITCHED_PRESETS.filter(
			(preset) => resolveVoicePriority(preset.definition) === 'low'
		).map((preset) => preset.id);

		expect(lowPriorityIds).toEqual(['filtered-drone']);
	});

	it.each(EXPECTED)('$id resolves the documented per-channel voice cap', (row) => {
		const definition = pitchedDefinitionOf(row.id);

		const expectedCap = row.polyphonic
			? Math.min(
					row.id === 'filtered-drone'
						? DEFAULT_AUDIO_LIMITS.maxDroneVoices
						: DEFAULT_AUDIO_LIMITS.maxVoicesPerChannel,
					row.maxVoices
				)
			: 1;
		expect(resolveMaxVoicesForChannel(definition, DEFAULT_AUDIO_LIMITS)).toBe(expectedCap);
	});

	it('caps a drone at maxDroneVoices even when the instrument asks for more', () => {
		const greedyDrone: PitchedInstrumentDefinition = {
			...pitchedDefinitionOf('filtered-drone'),
			voice: { polyphonic: true, maxVoices: 8, stealMode: 'oldest' }
		};

		expect(resolveMaxVoicesForChannel(greedyDrone, DEFAULT_AUDIO_LIMITS)).toBe(
			DEFAULT_AUDIO_LIMITS.maxDroneVoices
		);
	});
});
