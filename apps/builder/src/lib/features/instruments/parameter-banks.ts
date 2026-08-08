import type { InstrumentDefinition } from '@thinkbreak/audio-runtime';
import {
	getInstrumentParameter,
	type InstrumentParameterBankId,
	type InstrumentParameterKind,
	type InstrumentParameterPath,
	type InstrumentParameterSpec
} from './instrument-parameters.js';

/** Data shape consumed by the shared ParameterBank component without coupling its pure catalog to Svelte. */
export interface ParameterBankOptionData extends InstrumentParameterSpec {
	key: string;
	shortLabel: string;
	value: number;
}

export interface ParameterBankDefinition {
	id: InstrumentParameterBankId;
	label: string;
	kind: InstrumentParameterKind;
	options: readonly {
		path: InstrumentParameterPath;
		shortLabel: string;
		label: string;
	}[];
}

/** The only parameter banks allowed by the compact editor contract. */
export const PARAMETER_BANKS: readonly ParameterBankDefinition[] = [
	{
		id: 'pitched-tuning',
		label: 'Tuning',
		kind: 'pitched',
		options: [
			{ path: 'oscillator.octaveOffset', shortLabel: 'O', label: 'Octave' },
			{ path: 'oscillator.semitoneOffset', shortLabel: 'S', label: 'Semitone' },
			{ path: 'oscillator.fineDetuneCents', shortLabel: 'F', label: 'Fine' }
		]
	},
	{
		id: 'pitched-amplitude',
		label: 'Amplitude envelope',
		kind: 'pitched',
		options: [
			{ path: 'amplitudeEnvelope.attackSeconds', shortLabel: 'A', label: 'Attack' },
			{ path: 'amplitudeEnvelope.decaySeconds', shortLabel: 'D', label: 'Decay' },
			{ path: 'amplitudeEnvelope.sustainLevel', shortLabel: 'S', label: 'Sustain' },
			{ path: 'amplitudeEnvelope.releaseSeconds', shortLabel: 'R', label: 'Release' }
		]
	},
	{
		id: 'pitched-vibrato',
		label: 'Vibrato',
		kind: 'pitched',
		options: [
			{ path: 'modulation.vibratoRateHz', shortLabel: 'Rate', label: 'Rate' },
			{ path: 'modulation.vibratoDepthCents', shortLabel: 'Depth', label: 'Depth' }
		]
	},
	{
		id: 'oscillator-envelope',
		label: 'Oscillator envelope',
		kind: 'percussion',
		options: [
			{ path: 'oscillatorLayer.attackSeconds', shortLabel: 'A', label: 'Attack' },
			{ path: 'oscillatorLayer.decaySeconds', shortLabel: 'D', label: 'Decay' },
			{ path: 'oscillatorLayer.sustainLevel', shortLabel: 'S', label: 'Sustain' },
			{ path: 'oscillatorLayer.releaseSeconds', shortLabel: 'R', label: 'Release' }
		]
	},
	{
		id: 'noise-envelope',
		label: 'Noise envelope',
		kind: 'percussion',
		options: [
			{ path: 'noiseLayer.attackSeconds', shortLabel: 'A', label: 'Attack' },
			{ path: 'noiseLayer.decaySeconds', shortLabel: 'D', label: 'Decay' },
			{ path: 'noiseLayer.sustainLevel', shortLabel: 'S', label: 'Sustain' },
			{ path: 'noiseLayer.releaseSeconds', shortLabel: 'R', label: 'Release' }
		]
	},
	{
		id: 'oscillator-frequency',
		label: 'Oscillator pitch',
		kind: 'percussion',
		options: [
			{ path: 'oscillatorLayer.startFrequencyHz', shortLabel: 'Start', label: 'Start frequency' },
			{ path: 'oscillatorLayer.endFrequencyHz', shortLabel: 'End', label: 'End frequency' }
		]
	}
];

export function getParameterBank(id: InstrumentParameterBankId): ParameterBankDefinition {
	const bank = PARAMETER_BANKS.find((candidate) => candidate.id === id);
	if (bank === undefined) throw new Error(`Unknown parameter bank "${id}".`);
	return bank;
}

export function parameterBankOptions(
	bank: ParameterBankDefinition,
	definition: InstrumentDefinition
): readonly ParameterBankOptionData[] {
	if (definition.kind !== bank.kind) {
		throw new Error(
			`Parameter bank "${bank.id}" requires a ${bank.kind} instrument; received ${definition.kind}.`
		);
	}
	return bank.options.map((option) => {
		const parameter = getRequiredParameter(bank.kind, option.path);
		return {
			...parameter,
			key: option.path,
			shortLabel: option.shortLabel,
			value: readNumericInstrumentValue(definition, option.path)
		};
	});
}

function getRequiredParameter(
	kind: InstrumentParameterKind,
	path: InstrumentParameterPath
): InstrumentParameterSpec {
	const parameter = getInstrumentParameter(kind, path);
	if (parameter === undefined) {
		throw new Error(`Parameter bank references unknown ${kind} parameter "${path}".`);
	}
	return parameter;
}

function readNumericInstrumentValue(
	definition: InstrumentDefinition,
	path: InstrumentParameterPath
): number {
	let value: unknown = definition;
	for (const segment of path.split('.')) {
		if (typeof value !== 'object' || value === null || !(segment in value)) {
			throw new Error(`Unable to read numeric instrument parameter "${path}".`);
		}
		value = (value as Record<string, unknown>)[segment];
	}
	if (typeof value !== 'number') {
		throw new Error(`Instrument parameter "${path}" is not numeric.`);
	}
	return value;
}
