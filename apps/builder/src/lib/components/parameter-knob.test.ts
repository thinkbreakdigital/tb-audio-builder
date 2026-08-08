import { describe, expect, it } from 'vitest';
import {
	clamp,
	decimalPlaces,
	formatParameterValue,
	keyboardParameterValue,
	parseNumericDraft,
	ratioToValue,
	snapValue,
	valueToRatio
} from './parameter-knob.js';

describe('parameter value helpers', () => {
	it('clamps and snaps relative to a non-zero minimum without floating-point drift', () => {
		expect(clamp(12, 0, 10)).toBe(10);
		expect(snapValue(0.31, 0.1, 1, 0.1)).toBe(0.3);
		expect(snapValue(-0.94, -1, 1, 0.1)).toBe(-0.9);
		expect(decimalPlaces(1e-3)).toBe(3);
	});

	it('round-trips linear and logarithmic values', () => {
		for (const scale of ['linear', 'log'] as const) {
			const min = scale === 'log' ? 20 : -100;
			const max = scale === 'log' ? 20_000 : 100;
			const value = scale === 'log' ? 440 : 25;
			expect(ratioToValue(valueToRatio(value, min, max, scale), min, max, scale)).toBeCloseTo(
				value,
				8
			);
		}
	});

	it('rejects logarithmic ranges that include zero', () => {
		expect(() => valueToRatio(1, 0, 10, 'log')).toThrow(/greater than zero/);
		expect(() => ratioToValue(0.5, -1, 10, 'log')).toThrow(/greater than zero/);
	});

	it('validates numeric drafts before snapping them', () => {
		const options = { min: 0, max: 2, step: 0.1 };
		expect(parseNumericDraft('', options)).toEqual({ ok: false, reason: 'blank' });
		expect(parseNumericDraft('1.2x', options)).toEqual({ ok: false, reason: 'malformed' });
		expect(parseNumericDraft('Infinity', options)).toEqual({ ok: false, reason: 'malformed' });
		expect(parseNumericDraft('2.1', options)).toEqual({ ok: false, reason: 'out-of-range' });
		expect(parseNumericDraft('1.26', options)).toEqual({ ok: true, value: 1.3 });
	});

	it('applies normal, fine, page, and boundary keyboard changes', () => {
		const base = { value: 0.5, min: 0, max: 1, step: 0.1, fineStep: 0.01 };
		expect(keyboardParameterValue({ ...base, key: 'ArrowUp' })).toBe(0.6);
		expect(keyboardParameterValue({ ...base, key: 'ArrowDown', shiftKey: true })).toBe(0.49);
		expect(keyboardParameterValue({ ...base, key: 'PageDown' })).toBe(0);
		expect(keyboardParameterValue({ ...base, key: 'Home' })).toBe(0);
		expect(keyboardParameterValue({ ...base, key: 'End' })).toBe(1);
		expect(keyboardParameterValue({ ...base, key: 'Enter' })).toBeNull();
	});

	it('formats units without leaving a trailing space', () => {
		expect(formatParameterValue(0.5, 2, '')).toBe('0.50');
		expect(formatParameterValue(440, 0, 'Hz')).toBe('440 Hz');
	});
});
