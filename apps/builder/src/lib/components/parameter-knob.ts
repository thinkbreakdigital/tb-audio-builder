export type ParameterScale = 'linear' | 'log';

export interface NumericParseOptions {
	min: number;
	max: number;
	step: number;
}

export type NumericParseResult =
	{ ok: true; value: number } | { ok: false; reason: 'blank' | 'malformed' | 'out-of-range' };

const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function clamp(value: number, min: number, max: number): number {
	if (min > max) throw new Error(`Invalid parameter range: minimum ${min} exceeds maximum ${max}.`);
	return Math.min(max, Math.max(min, value));
}

export function decimalPlaces(step: number): number {
	if (!Number.isFinite(step) || step <= 0) {
		throw new Error(`Parameter step must be a positive finite number; received ${step}.`);
	}
	const text = step.toString().toLowerCase();
	if (text.includes('e-')) {
		const [coefficient, exponentText] = text.split('e-');
		const exponent = Number(exponentText);
		const fractionLength = coefficient?.split('.')[1]?.length ?? 0;
		return exponent + fractionLength;
	}
	return text.split('.')[1]?.length ?? 0;
}

export function snapValue(value: number, min: number, max: number, step: number): number {
	if (!Number.isFinite(value)) return min;
	const precision = Math.min(12, Math.max(decimalPlaces(step), decimalPlacesForBoundary(min)));
	const steps = Math.round((clamp(value, min, max) - min) / step);
	return clamp(Number((min + steps * step).toFixed(precision)), min, max);
}

function decimalPlacesForBoundary(value: number): number {
	if (Number.isInteger(value)) return 0;
	const text = value.toString().toLowerCase();
	if (text.includes('e-')) return Number(text.split('e-')[1] ?? 0);
	return text.split('.')[1]?.length ?? 0;
}

function assertScaleRange(min: number, max: number, scale: ParameterScale): void {
	if (min >= max) throw new Error(`Invalid parameter range: minimum ${min} must be below ${max}.`);
	if (scale === 'log' && min <= 0) {
		throw new Error(`Logarithmic parameter minimum must be greater than zero; received ${min}.`);
	}
}

export function valueToRatio(
	value: number,
	min: number,
	max: number,
	scale: ParameterScale = 'linear'
): number {
	assertScaleRange(min, max, scale);
	const bounded = clamp(value, min, max);
	if (scale === 'log') return Math.log(bounded / min) / Math.log(max / min);
	return (bounded - min) / (max - min);
}

export function ratioToValue(
	ratio: number,
	min: number,
	max: number,
	scale: ParameterScale = 'linear'
): number {
	assertScaleRange(min, max, scale);
	const bounded = clamp(ratio, 0, 1);
	if (scale === 'log') return min * Math.pow(max / min, bounded);
	return min + bounded * (max - min);
}

export function parseNumericDraft(draft: string, options: NumericParseOptions): NumericParseResult {
	const trimmed = draft.trim();
	if (trimmed === '') return { ok: false, reason: 'blank' };
	if (!NUMBER_PATTERN.test(trimmed)) return { ok: false, reason: 'malformed' };
	const value = Number(trimmed);
	if (!Number.isFinite(value)) return { ok: false, reason: 'malformed' };
	if (value < options.min || value > options.max) {
		return { ok: false, reason: 'out-of-range' };
	}
	return {
		ok: true,
		value: snapValue(value, options.min, options.max, options.step)
	};
}

export function formatParameterValue(value: number, decimals: number, unit: string): string {
	const formatted = value.toFixed(Math.max(0, decimals));
	return unit === '' ? formatted : `${formatted} ${unit}`;
}

export function keyboardParameterValue(input: {
	value: number;
	key: string;
	min: number;
	max: number;
	step: number;
	fineStep?: number;
	shiftKey?: boolean;
}): number | null {
	const { value, key, min, max, step, fineStep, shiftKey = false } = input;
	if (key === 'Home') return min;
	if (key === 'End') return max;

	const direction = key === 'ArrowUp' || key === 'ArrowRight' || key === 'PageUp' ? 1 : -1;
	if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'PageUp', 'PageDown'].includes(key)) {
		return null;
	}
	const effectiveStep = shiftKey ? (fineStep ?? step / 10) : step;
	const multiplier = key === 'PageUp' || key === 'PageDown' ? 10 : 1;
	return snapValue(value + direction * effectiveStep * multiplier, min, max, effectiveStep);
}
