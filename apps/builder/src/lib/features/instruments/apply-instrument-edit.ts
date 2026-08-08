import type { InstrumentDefinition } from '@thinkbreak/audio-runtime';
import { getInstrumentParameter, type InstrumentParameterSpec } from './instrument-parameters.js';

/**
 * Applies one validated numeric edit while retaining the instrument's provenance and untouched
 * branches by reference. Preset IDs are provenance, not an assertion that a definition is pristine.
 */
export function applyInstrumentEdit(
	definition: InstrumentDefinition,
	path: string,
	value: number
): InstrumentDefinition {
	const parameter = getInstrumentParameter(definition.kind, path);
	if (parameter === undefined) {
		throwUnknownOrMismatchedPath(definition, path);
	}
	validateValue(parameter, value);

	if (definition.kind === 'pitched') {
		switch (path) {
			case 'oscillator.octaveOffset':
			case 'oscillator.semitoneOffset':
			case 'oscillator.fineDetuneCents':
				return {
					...definition,
					oscillator: { ...definition.oscillator, [lastSegment(path)]: value }
				};
			case 'amplitudeEnvelope.attackSeconds':
			case 'amplitudeEnvelope.decaySeconds':
			case 'amplitudeEnvelope.sustainLevel':
			case 'amplitudeEnvelope.releaseSeconds':
				return {
					...definition,
					amplitudeEnvelope: { ...definition.amplitudeEnvelope, [lastSegment(path)]: value }
				};
			case 'filter.frequencyHz':
			case 'filter.q':
				return { ...definition, filter: { ...definition.filter, [lastSegment(path)]: value } };
			case 'modulation.vibratoRateHz':
			case 'modulation.vibratoDepthCents':
			case 'modulation.pitchBendRangeSemitones':
				return {
					...definition,
					modulation: { ...definition.modulation, [lastSegment(path)]: value }
				};
			case 'voice.maxVoices':
				return { ...definition, voice: { ...definition.voice, maxVoices: value } };
			default:
				throw new Error(`Unsupported numeric instrument parameter path "${path}".`);
		}
	}

	switch (path) {
		case 'rootMidiNote':
			return { ...definition, rootMidiNote: value };
		case 'oscillatorLayer.startFrequencyHz':
		case 'oscillatorLayer.endFrequencyHz':
		case 'oscillatorLayer.pitchDecaySeconds':
		case 'oscillatorLayer.attackSeconds':
		case 'oscillatorLayer.decaySeconds':
		case 'oscillatorLayer.sustainLevel':
		case 'oscillatorLayer.releaseSeconds':
		case 'oscillatorLayer.gain':
			return {
				...definition,
				oscillatorLayer: { ...definition.oscillatorLayer, [lastSegment(path)]: value }
			};
		case 'noiseLayer.filterFrequencyHz':
		case 'noiseLayer.filterQ':
		case 'noiseLayer.attackSeconds':
		case 'noiseLayer.decaySeconds':
		case 'noiseLayer.sustainLevel':
		case 'noiseLayer.releaseSeconds':
		case 'noiseLayer.gain':
			return {
				...definition,
				noiseLayer: { ...definition.noiseLayer, [lastSegment(path)]: value }
			};
		default:
			throw new Error(`Unsupported numeric instrument parameter path "${path}".`);
	}
}

function validateValue(parameter: InstrumentParameterSpec, value: number): void {
	if (!Number.isFinite(value) || value < parameter.min || value > parameter.max) {
		throw new Error(
			`Invalid value for ${parameter.kind} parameter "${parameter.path}": expected a finite number ` +
				`from ${parameter.min} to ${parameter.max}; received ${value}.`
		);
	}
	if (parameter.integer && !Number.isInteger(value)) {
		throw new Error(
			`Invalid value for ${parameter.kind} parameter "${parameter.path}": expected a whole-number step; received ${value}.`
		);
	}
}

function throwUnknownOrMismatchedPath(definition: InstrumentDefinition, path: string): never {
	const otherKind = definition.kind === 'pitched' ? 'percussion' : 'pitched';
	if (getInstrumentParameter(otherKind, path) !== undefined) {
		throw new Error(
			`Cannot apply parameter "${path}" to a ${definition.kind} instrument; it belongs to ${otherKind}.`
		);
	}
	throw new Error(`Unknown numeric instrument parameter path "${path}" for ${definition.kind}.`);
}

function lastSegment(path: string): string {
	return path.slice(path.lastIndexOf('.') + 1);
}
