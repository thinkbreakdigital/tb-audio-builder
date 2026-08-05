/** Instrument definitions. Mixing lives on the channel, never here. */

export type PitchedWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';
export type FilterKind = 'lowpass' | 'highpass' | 'bandpass';
export type VoiceStealMode = 'oldest' | 'quietest' | 'lowest-pitch';

export interface AmplitudeEnvelope {
	attackSeconds: number; // 0..2
	decaySeconds: number; // 0..2
	sustainLevel: number; // 0..1
	releaseSeconds: number; // 0..5
}

export interface PitchedInstrumentDefinition {
	kind: 'pitched';
	presetId: string | null; // provenance only; edits do not clear it
	oscillator: {
		waveform: PitchedWaveform;
		octaveOffset: number; // -3..3, integer
		semitoneOffset: number; // -12..12, integer
		fineDetuneCents: number; // -100..100
	};
	amplitudeEnvelope: AmplitudeEnvelope;
	filter: {
		enabled: boolean;
		type: FilterKind;
		frequencyHz: number; // 20..20000
		q: number; // 0.1..20
	};
	modulation: {
		vibratoEnabled: boolean;
		vibratoRateHz: number; // 0..20
		vibratoDepthCents: number; // 0..100
		pitchBendRangeSemitones: number; // 0..24
	};
	voice: {
		polyphonic: boolean;
		maxVoices: number; // 1..8
		stealMode: VoiceStealMode;
	};
}

export interface PercussionInstrumentDefinition {
	kind: 'percussion';
	presetId: string | null;
	oscillatorLayer: {
		enabled: boolean;
		waveform: PitchedWaveform;
		startFrequencyHz: number; // 20..8000
		endFrequencyHz: number; // 20..8000
		pitchDecaySeconds: number; // 0.001..1
		attackSeconds: number; // 0..0.5
		decaySeconds: number; // 0.001..2
		sustainLevel: number; // 0..1
		releaseSeconds: number; // 0.001..2
		gain: number; // 0..1
	};
	noiseLayer: {
		enabled: boolean;
		filterType: FilterKind;
		filterFrequencyHz: number; // 20..20000
		filterQ: number; // 0.1..20
		attackSeconds: number; // 0..0.5
		decaySeconds: number; // 0.001..2
		sustainLevel: number; // 0..1
		releaseSeconds: number; // 0.001..2
		gain: number; // 0..1
	};
	chokeGroup: string | null;
}

export type InstrumentDefinition = PitchedInstrumentDefinition | PercussionInstrumentDefinition;
