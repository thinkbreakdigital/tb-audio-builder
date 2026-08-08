import { describe, expect, it } from 'vitest';
import {
	formatMidiNote,
	INSTRUMENT_PARAMETERS,
	type InstrumentParameterPath
} from './instrument-parameters.js';

const PITCHED_NUMERIC_PATHS: readonly InstrumentParameterPath[] = [
	'oscillator.octaveOffset',
	'oscillator.semitoneOffset',
	'oscillator.fineDetuneCents',
	'amplitudeEnvelope.attackSeconds',
	'amplitudeEnvelope.decaySeconds',
	'amplitudeEnvelope.sustainLevel',
	'amplitudeEnvelope.releaseSeconds',
	'filter.frequencyHz',
	'filter.q',
	'modulation.vibratoRateHz',
	'modulation.vibratoDepthCents',
	'modulation.pitchBendRangeSemitones',
	'voice.maxVoices'
];

const PERCUSSION_NUMERIC_PATHS: readonly InstrumentParameterPath[] = [
	'rootMidiNote',
	'oscillatorLayer.startFrequencyHz',
	'oscillatorLayer.endFrequencyHz',
	'oscillatorLayer.pitchDecaySeconds',
	'oscillatorLayer.attackSeconds',
	'oscillatorLayer.decaySeconds',
	'oscillatorLayer.sustainLevel',
	'oscillatorLayer.releaseSeconds',
	'oscillatorLayer.gain',
	'noiseLayer.filterFrequencyHz',
	'noiseLayer.filterQ',
	'noiseLayer.attackSeconds',
	'noiseLayer.decaySeconds',
	'noiseLayer.sustainLevel',
	'noiseLayer.releaseSeconds',
	'noiseLayer.gain'
];

describe('instrument parameter catalog', () => {
	it('covers every numeric schema leaf exactly once with valid control metadata', () => {
		const pathsFor = (kind: 'pitched' | 'percussion') =>
			INSTRUMENT_PARAMETERS.filter((parameter) => parameter.kind === kind).map(
				(parameter) => parameter.path
			);

		expect(pathsFor('pitched').sort()).toEqual([...PITCHED_NUMERIC_PATHS].sort());
		expect(pathsFor('percussion').sort()).toEqual([...PERCUSSION_NUMERIC_PATHS].sort());
		expect(new Set(INSTRUMENT_PARAMETERS.map(({ kind, path }) => `${kind}:${path}`)).size).toBe(
			INSTRUMENT_PARAMETERS.length
		);

		for (const parameter of INSTRUMENT_PARAMETERS) {
			expect(parameter.min).toBeLessThanOrEqual(parameter.defaultValue);
			expect(parameter.defaultValue).toBeLessThanOrEqual(parameter.max);
			expect(parameter.min).toBeLessThan(parameter.max);
			expect(parameter.step).toBeGreaterThan(0);
			expect(parameter.fineStep).toBeGreaterThan(0);
			if (parameter.scale === 'log') expect(parameter.min).toBeGreaterThan(0);
		}
	});

	it('formats edge and middle MIDI notes in musician-readable notation', () => {
		expect(formatMidiNote(0)).toBe('C-1 (0)');
		expect(formatMidiNote(60)).toBe('C4 (60)');
		expect(formatMidiNote(127)).toBe('G9 (127)');
		expect(() => formatMidiNote(60.5)).toThrow(/integer from 0 to 127/);
		expect(() => formatMidiNote(128)).toThrow(/integer from 0 to 127/);
	});
});
