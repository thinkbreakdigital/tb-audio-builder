import {
	createDefaultPercussionInstrument,
	createDefaultPitchedInstrument
} from '@thinkbreak/audio-runtime';
import { describe, expect, it } from 'vitest';
import { INSTRUMENT_PARAMETERS, type InstrumentParameterPath } from './instrument-parameters.js';
import { getParameterBank, parameterBankOptions, PARAMETER_BANKS } from './parameter-banks.js';

describe('parameter banks', () => {
	it('defines exactly the approved banks and every banked catalog parameter once', () => {
		expect(PARAMETER_BANKS.map((bank) => bank.id)).toEqual([
			'pitched-tuning',
			'pitched-amplitude',
			'pitched-vibrato',
			'oscillator-envelope',
			'noise-envelope',
			'oscillator-frequency'
		]);

		const bankEntries = PARAMETER_BANKS.flatMap((bank) =>
			bank.options.map((option) => `${bank.kind}:${option.path}`)
		);
		expect(new Set(bankEntries).size).toBe(bankEntries.length);
		expect(
			INSTRUMENT_PARAMETERS.filter((parameter) => parameter.bank !== null)
				.map((parameter) => `${parameter.kind}:${parameter.path}`)
				.sort()
		).toEqual([...bankEntries].sort());
	});

	it('keeps selector names unique and forbids unrelated controls from banks', () => {
		for (const bank of PARAMETER_BANKS) {
			expect(new Set(bank.options.map((option) => option.shortLabel)).size).toBe(
				bank.options.length
			);
			expect(new Set(bank.options.map((option) => option.label)).size).toBe(bank.options.length);
		}

		const bankedPaths = new Set(
			PARAMETER_BANKS.flatMap((bank) => bank.options.map((option) => option.path))
		);
		for (const forbiddenPath of [
			'filter.frequencyHz',
			'filter.q',
			'noiseLayer.filterFrequencyHz',
			'noiseLayer.filterQ',
			'oscillatorLayer.gain',
			'noiseLayer.gain',
			'rootMidiNote',
			'modulation.pitchBendRangeSemitones',
			'voice.maxVoices'
		] satisfies readonly InstrumentParameterPath[]) {
			expect(bankedPaths.has(forbiddenPath)).toBe(false);
		}
	});

	it('derives values from one matching instrument and rejects a mismatched bank kind', () => {
		const pitched = createDefaultPitchedInstrument();
		const tuning = parameterBankOptions(getParameterBank('pitched-tuning'), pitched);
		expect(tuning.map(({ key, value }) => [key, value])).toEqual([
			['oscillator.octaveOffset', pitched.oscillator.octaveOffset],
			['oscillator.semitoneOffset', pitched.oscillator.semitoneOffset],
			['oscillator.fineDetuneCents', pitched.oscillator.fineDetuneCents]
		]);
		expect(() =>
			parameterBankOptions(getParameterBank('pitched-tuning'), createDefaultPercussionInstrument())
		).toThrow(/requires a pitched instrument/);
	});
});
