/**
 * Pure numeric formulas shared across the engine. This is the single definition of each of
 * these conversions in the repository — everyone else imports from here rather than re-deriving
 * them (`00-conventions.md` §4 rule 10).
 */

/** Equal-temperament MIDI note to frequency, A4 (69) = 440Hz, plus fine detune in cents. */
export function midiNoteToFrequencyHz(midiNote: number, detuneCents = 0): number {
	return 440 * 2 ** ((midiNote - 69) / 12) * 2 ** (detuneCents / 1200);
}

/** Squaring velocity tracks perceived loudness better than the raw linear MIDI value. */
export function velocityToGain(velocity: number): number {
	return clamp(velocity ** 2, 0, 1);
}

export function decibelsToLinear(db: number): number {
	return 10 ** (db / 20);
}

/** Floors the input so silence never produces `-Infinity`. */
export function linearToDecibels(linear: number): number {
	return 20 * Math.log10(Math.max(linear, 1e-6));
}

/** `bendValue` is the normalized -1..1 pitch wheel position. */
export function pitchBendToSemitones(bendValue: number, rangeSemitones: number): number {
	return bendValue * rangeSemitones;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
