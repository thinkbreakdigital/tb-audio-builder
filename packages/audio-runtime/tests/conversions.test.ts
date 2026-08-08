import { describe, expect, it } from 'vitest';
import {
	clamp,
	decibelsToLinear,
	linearToDecibels,
	midiNoteToFrequencyHz,
	pitchBendToSemitones,
	velocityToGain
} from '../src/synth/conversions.js';

describe('midiNoteToFrequencyHz', () => {
	it('A4 (69) is 440Hz', () => {
		expect(midiNoteToFrequencyHz(69)).toBeCloseTo(440, 6);
	});

	it('C4 (60) is approximately 261.626Hz', () => {
		expect(midiNoteToFrequencyHz(60)).toBeCloseTo(261.626, 3);
	});

	it('one octave doubles the frequency', () => {
		const base = midiNoteToFrequencyHz(60);
		const octaveUp = midiNoteToFrequencyHz(72);
		expect(octaveUp).toBeCloseTo(base * 2, 6);
	});

	it('+100 cents of detune is one semitone up', () => {
		const semitoneUp = midiNoteToFrequencyHz(61);
		const detuned = midiNoteToFrequencyHz(60, 100);
		expect(detuned).toBeCloseTo(semitoneUp, 6);
	});

	it('-100 cents of detune is one semitone down', () => {
		const semitoneDown = midiNoteToFrequencyHz(59);
		const detuned = midiNoteToFrequencyHz(60, -100);
		expect(detuned).toBeCloseTo(semitoneDown, 6);
	});
});

describe('velocityToGain', () => {
	it('is monotonic across the 0..1 range', () => {
		let previous = -Infinity;
		for (let velocity = 0; velocity <= 1; velocity += 0.05) {
			const gain = velocityToGain(velocity);
			expect(gain).toBeGreaterThanOrEqual(previous);
			previous = gain;
		}
	});

	it('is bounded to 0..1', () => {
		expect(velocityToGain(0)).toBe(0);
		expect(velocityToGain(1)).toBe(1);
		expect(velocityToGain(2)).toBeLessThanOrEqual(1);
		expect(velocityToGain(-1)).toBeGreaterThanOrEqual(0);
	});
});

describe('decibelsToLinear / linearToDecibels', () => {
	it('round-trips through both directions', () => {
		for (const db of [-60, -12, -6, 0, 6]) {
			const linear = decibelsToLinear(db);
			expect(linearToDecibels(linear)).toBeCloseTo(db, 6);
		}
	});

	it('0dB is unity gain', () => {
		expect(decibelsToLinear(0)).toBeCloseTo(1, 10);
	});
});

describe('pitchBendToSemitones', () => {
	it('scales the normalized bend value by the range', () => {
		expect(pitchBendToSemitones(1, 2)).toBeCloseTo(2, 10);
		expect(pitchBendToSemitones(-1, 2)).toBeCloseTo(-2, 10);
		expect(pitchBendToSemitones(0, 2)).toBe(0);
		expect(pitchBendToSemitones(0.5, 12)).toBeCloseTo(6, 10);
	});
});

describe('clamp', () => {
	it('clamps below, within, and above the range', () => {
		expect(clamp(-1, 0, 1)).toBe(0);
		expect(clamp(0.5, 0, 1)).toBe(0.5);
		expect(clamp(2, 0, 1)).toBe(1);
	});
});
