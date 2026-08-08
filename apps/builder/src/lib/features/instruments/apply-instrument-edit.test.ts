import {
	createDefaultPercussionInstrument,
	createDefaultPitchedInstrument,
	type InstrumentDefinition
} from '@thinkbreak/audio-runtime';
import { describe, expect, it } from 'vitest';
import { applyInstrumentEdit } from './apply-instrument-edit.js';

describe('applyInstrumentEdit', () => {
	it('immutably updates a nested pitched value without clearing preset provenance', () => {
		const source = createDefaultPitchedInstrument();
		const edited = applyInstrumentEdit(source, 'filter.frequencyHz', 3_000);

		expect(edited).not.toBe(source);
		expect(edited.kind).toBe('pitched');
		if (edited.kind !== 'pitched') throw new Error('Expected pitched definition.');
		expect(edited.filter.frequencyHz).toBe(3_000);
		expect(source.filter.frequencyHz).toBe(5_000);
		expect(edited.presetId).toBe(source.presetId);
		expect(edited.oscillator).toBe(source.oscillator);
	});

	it('only copies the edited percussion branch and preserves the discriminated kind', () => {
		const source = createDefaultPercussionInstrument();
		const edited = applyInstrumentEdit(source, 'oscillatorLayer.gain', 0.4);

		expect(edited.kind).toBe('percussion');
		if (edited.kind !== 'percussion') throw new Error('Expected percussion definition.');
		expect(edited.oscillatorLayer).not.toBe(source.oscillatorLayer);
		expect(edited.noiseLayer).toBe(source.noiseLayer);
		expect(edited.oscillatorLayer.gain).toBe(0.4);
		expect(source.oscillatorLayer.gain).toBe(0.9);
	});

	it('rejects unknown, mismatched, malformed, and out-of-range edits with context', () => {
		const pitched = createDefaultPitchedInstrument();
		expect(() => applyInstrumentEdit(pitched, 'not.a.parameter', 1)).toThrow(
			/Unknown numeric.*not.a.parameter/
		);
		expect(() => applyInstrumentEdit(pitched, 'rootMidiNote', 60)).toThrow(/belongs to percussion/);
		expect(() => applyInstrumentEdit(pitched, 'filter.frequencyHz', Number.NaN)).toThrow(
			/finite number/
		);
		expect(() => applyInstrumentEdit(pitched, 'voice.maxVoices', 2.5)).toThrow(/whole-number step/);
		expect(applyInstrumentEdit(pitched, 'filter.frequencyHz', 440.5)).toMatchObject({
			filter: { frequencyHz: 440.5 }
		});
		expect(() =>
			applyInstrumentEdit(createDefaultPercussionInstrument(), 'rootMidiNote', 60.5)
		).toThrow(/whole-number step/);
	});

	it('does not mutate its input under any supported edit', () => {
		const source: InstrumentDefinition = createDefaultPercussionInstrument();
		const before = structuredClone(source);
		applyInstrumentEdit(source, 'noiseLayer.filterQ', 2.5);
		expect(source).toEqual(before);
	});
});
