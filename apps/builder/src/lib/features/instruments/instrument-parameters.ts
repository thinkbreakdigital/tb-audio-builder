import {
	createDefaultPercussionInstrument,
	createDefaultPitchedInstrument,
	type InstrumentDefinition
} from '@thinkbreak/audio-runtime';
export type ParameterScale = 'linear' | 'log';

export type InstrumentParameterKind = InstrumentDefinition['kind'];
export type InstrumentParameterBankId =
	| 'pitched-tuning'
	| 'pitched-amplitude'
	| 'pitched-vibrato'
	| 'oscillator-envelope'
	| 'noise-envelope'
	| 'oscillator-frequency';

export type PitchedInstrumentParameterPath =
	| 'oscillator.octaveOffset'
	| 'oscillator.semitoneOffset'
	| 'oscillator.fineDetuneCents'
	| 'amplitudeEnvelope.attackSeconds'
	| 'amplitudeEnvelope.decaySeconds'
	| 'amplitudeEnvelope.sustainLevel'
	| 'amplitudeEnvelope.releaseSeconds'
	| 'filter.frequencyHz'
	| 'filter.q'
	| 'modulation.vibratoRateHz'
	| 'modulation.vibratoDepthCents'
	| 'modulation.pitchBendRangeSemitones'
	| 'voice.maxVoices';

export type PercussionInstrumentParameterPath =
	| 'rootMidiNote'
	| 'oscillatorLayer.startFrequencyHz'
	| 'oscillatorLayer.endFrequencyHz'
	| 'oscillatorLayer.pitchDecaySeconds'
	| 'oscillatorLayer.attackSeconds'
	| 'oscillatorLayer.decaySeconds'
	| 'oscillatorLayer.sustainLevel'
	| 'oscillatorLayer.releaseSeconds'
	| 'oscillatorLayer.gain'
	| 'noiseLayer.filterFrequencyHz'
	| 'noiseLayer.filterQ'
	| 'noiseLayer.attackSeconds'
	| 'noiseLayer.decaySeconds'
	| 'noiseLayer.sustainLevel'
	| 'noiseLayer.releaseSeconds'
	| 'noiseLayer.gain';

export type InstrumentParameterPath =
	PitchedInstrumentParameterPath | PercussionInstrumentParameterPath;

export interface InstrumentParameterSpec {
	kind: InstrumentParameterKind;
	path: InstrumentParameterPath;
	label: string;
	group: string;
	min: number;
	max: number;
	step: number;
	fineStep: number;
	unit: string;
	decimals: number;
	scale: ParameterScale;
	defaultValue: number;
	bank: InstrumentParameterBankId | null;
	/** True only for leaves the schema itself defines as integers. */
	integer: boolean;
}

const SCHEMA_INTEGER_PARAMETERS = new Set<string>([
	'pitched:oscillator.octaveOffset',
	'pitched:oscillator.semitoneOffset',
	'pitched:voice.maxVoices',
	'percussion:rootMidiNote'
]);

const pitchedDefault = createDefaultPitchedInstrument();
const percussionDefault = createDefaultPercussionInstrument();

function spec(
	kind: InstrumentParameterKind,
	path: InstrumentParameterPath,
	label: string,
	group: string,
	min: number,
	max: number,
	step: number,
	fineStep: number,
	unit: string,
	decimals: number,
	scale: ParameterScale,
	defaultValue: number,
	bank: InstrumentParameterBankId | null
): InstrumentParameterSpec {
	return {
		kind,
		path,
		label,
		group,
		min,
		max,
		step,
		fineStep,
		unit,
		decimals,
		scale,
		defaultValue,
		bank,
		integer: SCHEMA_INTEGER_PARAMETERS.has(`${kind}:${path}`)
	};
}

/**
 * The authoritative numeric-control catalog. Boolean and select leaves intentionally do not
 * appear here; every numeric leaf in the discriminated runtime instrument definitions appears once.
 */
export const INSTRUMENT_PARAMETERS: readonly InstrumentParameterSpec[] = [
	spec(
		'pitched',
		'oscillator.octaveOffset',
		'Octave',
		'Oscillator',
		-3,
		3,
		1,
		1,
		'',
		0,
		'linear',
		pitchedDefault.oscillator.octaveOffset,
		'pitched-tuning'
	),
	spec(
		'pitched',
		'oscillator.semitoneOffset',
		'Semitone',
		'Oscillator',
		-12,
		12,
		1,
		1,
		'st',
		0,
		'linear',
		pitchedDefault.oscillator.semitoneOffset,
		'pitched-tuning'
	),
	spec(
		'pitched',
		'oscillator.fineDetuneCents',
		'Fine',
		'Oscillator',
		-100,
		100,
		1,
		1,
		'cents',
		0,
		'linear',
		pitchedDefault.oscillator.fineDetuneCents,
		'pitched-tuning'
	),
	spec(
		'pitched',
		'amplitudeEnvelope.attackSeconds',
		'Attack',
		'Amplitude',
		0,
		2,
		0.001,
		0.0001,
		's',
		3,
		'linear',
		pitchedDefault.amplitudeEnvelope.attackSeconds,
		'pitched-amplitude'
	),
	spec(
		'pitched',
		'amplitudeEnvelope.decaySeconds',
		'Decay',
		'Amplitude',
		0,
		2,
		0.001,
		0.0001,
		's',
		3,
		'linear',
		pitchedDefault.amplitudeEnvelope.decaySeconds,
		'pitched-amplitude'
	),
	spec(
		'pitched',
		'amplitudeEnvelope.sustainLevel',
		'Sustain',
		'Amplitude',
		0,
		1,
		0.01,
		0.001,
		'',
		2,
		'linear',
		pitchedDefault.amplitudeEnvelope.sustainLevel,
		'pitched-amplitude'
	),
	spec(
		'pitched',
		'amplitudeEnvelope.releaseSeconds',
		'Release',
		'Amplitude',
		0,
		5,
		0.001,
		0.0001,
		's',
		3,
		'linear',
		pitchedDefault.amplitudeEnvelope.releaseSeconds,
		'pitched-amplitude'
	),
	spec(
		'pitched',
		'filter.frequencyHz',
		'Cutoff',
		'Filter',
		20,
		20_000,
		1,
		1,
		'Hz',
		0,
		'log',
		pitchedDefault.filter.frequencyHz,
		null
	),
	spec(
		'pitched',
		'filter.q',
		'Resonance',
		'Filter',
		0.1,
		20,
		0.1,
		0.01,
		'Q',
		1,
		'linear',
		pitchedDefault.filter.q,
		null
	),
	spec(
		'pitched',
		'modulation.vibratoRateHz',
		'Vibrato rate',
		'Modulation',
		0,
		20,
		0.1,
		0.01,
		'Hz',
		1,
		'linear',
		pitchedDefault.modulation.vibratoRateHz,
		'pitched-vibrato'
	),
	spec(
		'pitched',
		'modulation.vibratoDepthCents',
		'Vibrato depth',
		'Modulation',
		0,
		100,
		1,
		0.1,
		'cents',
		0,
		'linear',
		pitchedDefault.modulation.vibratoDepthCents,
		'pitched-vibrato'
	),
	spec(
		'pitched',
		'modulation.pitchBendRangeSemitones',
		'Bend range',
		'Modulation',
		0,
		24,
		1,
		1,
		'st',
		0,
		'linear',
		pitchedDefault.modulation.pitchBendRangeSemitones,
		null
	),
	spec(
		'pitched',
		'voice.maxVoices',
		'Max voices',
		'Voices',
		1,
		8,
		1,
		1,
		'',
		0,
		'linear',
		pitchedDefault.voice.maxVoices,
		null
	),

	spec(
		'percussion',
		'rootMidiNote',
		'Root note',
		'Instrument',
		0,
		127,
		1,
		1,
		'',
		0,
		'linear',
		percussionDefault.rootMidiNote,
		null
	),
	spec(
		'percussion',
		'oscillatorLayer.startFrequencyHz',
		'Start frequency',
		'Oscillator layer',
		20,
		8_000,
		1,
		1,
		'Hz',
		0,
		'log',
		percussionDefault.oscillatorLayer.startFrequencyHz,
		'oscillator-frequency'
	),
	spec(
		'percussion',
		'oscillatorLayer.endFrequencyHz',
		'End frequency',
		'Oscillator layer',
		20,
		8_000,
		1,
		1,
		'Hz',
		0,
		'log',
		percussionDefault.oscillatorLayer.endFrequencyHz,
		'oscillator-frequency'
	),
	spec(
		'percussion',
		'oscillatorLayer.pitchDecaySeconds',
		'Pitch decay',
		'Oscillator layer',
		0.001,
		1,
		0.001,
		0.0001,
		's',
		3,
		'linear',
		percussionDefault.oscillatorLayer.pitchDecaySeconds,
		null
	),
	spec(
		'percussion',
		'oscillatorLayer.attackSeconds',
		'Attack',
		'Oscillator layer',
		0,
		0.5,
		0.001,
		0.0001,
		's',
		3,
		'linear',
		percussionDefault.oscillatorLayer.attackSeconds,
		'oscillator-envelope'
	),
	spec(
		'percussion',
		'oscillatorLayer.decaySeconds',
		'Decay',
		'Oscillator layer',
		0.001,
		2,
		0.001,
		0.0001,
		's',
		3,
		'linear',
		percussionDefault.oscillatorLayer.decaySeconds,
		'oscillator-envelope'
	),
	spec(
		'percussion',
		'oscillatorLayer.sustainLevel',
		'Sustain',
		'Oscillator layer',
		0,
		1,
		0.01,
		0.001,
		'',
		2,
		'linear',
		percussionDefault.oscillatorLayer.sustainLevel,
		'oscillator-envelope'
	),
	spec(
		'percussion',
		'oscillatorLayer.releaseSeconds',
		'Release',
		'Oscillator layer',
		0.001,
		2,
		0.001,
		0.0001,
		's',
		3,
		'linear',
		percussionDefault.oscillatorLayer.releaseSeconds,
		'oscillator-envelope'
	),
	spec(
		'percussion',
		'oscillatorLayer.gain',
		'Layer gain',
		'Oscillator layer',
		0,
		1,
		0.01,
		0.001,
		'',
		2,
		'linear',
		percussionDefault.oscillatorLayer.gain,
		null
	),
	spec(
		'percussion',
		'noiseLayer.filterFrequencyHz',
		'Cutoff',
		'Noise layer',
		20,
		20_000,
		1,
		1,
		'Hz',
		0,
		'log',
		percussionDefault.noiseLayer.filterFrequencyHz,
		null
	),
	spec(
		'percussion',
		'noiseLayer.filterQ',
		'Resonance',
		'Noise layer',
		0.1,
		20,
		0.1,
		0.01,
		'Q',
		1,
		'linear',
		percussionDefault.noiseLayer.filterQ,
		null
	),
	spec(
		'percussion',
		'noiseLayer.attackSeconds',
		'Attack',
		'Noise layer',
		0,
		0.5,
		0.001,
		0.0001,
		's',
		3,
		'linear',
		percussionDefault.noiseLayer.attackSeconds,
		'noise-envelope'
	),
	spec(
		'percussion',
		'noiseLayer.decaySeconds',
		'Decay',
		'Noise layer',
		0.001,
		2,
		0.001,
		0.0001,
		's',
		3,
		'linear',
		percussionDefault.noiseLayer.decaySeconds,
		'noise-envelope'
	),
	spec(
		'percussion',
		'noiseLayer.sustainLevel',
		'Sustain',
		'Noise layer',
		0,
		1,
		0.01,
		0.001,
		'',
		2,
		'linear',
		percussionDefault.noiseLayer.sustainLevel,
		'noise-envelope'
	),
	spec(
		'percussion',
		'noiseLayer.releaseSeconds',
		'Release',
		'Noise layer',
		0.001,
		2,
		0.001,
		0.0001,
		's',
		3,
		'linear',
		percussionDefault.noiseLayer.releaseSeconds,
		'noise-envelope'
	),
	spec(
		'percussion',
		'noiseLayer.gain',
		'Layer gain',
		'Noise layer',
		0,
		1,
		0.01,
		0.001,
		'',
		2,
		'linear',
		percussionDefault.noiseLayer.gain,
		null
	)
];

export function getInstrumentParameter(
	kind: InstrumentParameterKind,
	path: string
): InstrumentParameterSpec | undefined {
	return INSTRUMENT_PARAMETERS.find(
		(parameter) => parameter.kind === kind && parameter.path === path
	);
}

/** Formats MIDI note numbers in the musician-facing convention where middle C is C4 (60). */
export function formatMidiNote(midiNote: number): string {
	if (!Number.isInteger(midiNote) || midiNote < 0 || midiNote > 127) {
		throw new Error(`MIDI note must be an integer from 0 to 127; received ${midiNote}.`);
	}
	const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const name = names[midiNote % 12];
	const octave = Math.floor(midiNote / 12) - 1;
	return `${name}${octave} (${midiNote})`;
}
