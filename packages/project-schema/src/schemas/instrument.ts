import { z } from 'zod';

export const PitchedWaveformSchema = z.enum(['sine', 'triangle', 'square', 'sawtooth']);
export const FilterKindSchema = z.enum(['lowpass', 'highpass', 'bandpass']);
export const VoiceStealModeSchema = z.enum(['oldest', 'quietest', 'lowest-pitch']);

export const AmplitudeEnvelopeSchema = z
	.object({
		attackSeconds: z.number().min(0).max(2),
		decaySeconds: z.number().min(0).max(2),
		sustainLevel: z.number().min(0).max(1),
		releaseSeconds: z.number().min(0).max(5)
	})
	.strict();

export const PitchedInstrumentDefinitionSchema = z
	.object({
		kind: z.literal('pitched'),
		presetId: z.string().min(1).nullable(),
		oscillator: z
			.object({
				waveform: PitchedWaveformSchema,
				octaveOffset: z.number().int().min(-3).max(3),
				semitoneOffset: z.number().int().min(-12).max(12),
				fineDetuneCents: z.number().min(-100).max(100)
			})
			.strict(),
		amplitudeEnvelope: AmplitudeEnvelopeSchema,
		filter: z
			.object({
				enabled: z.boolean(),
				type: FilterKindSchema,
				frequencyHz: z.number().min(20).max(20_000),
				q: z.number().min(0.1).max(20)
			})
			.strict(),
		modulation: z
			.object({
				vibratoEnabled: z.boolean(),
				vibratoRateHz: z.number().min(0).max(20),
				vibratoDepthCents: z.number().min(0).max(100),
				pitchBendRangeSemitones: z.number().min(0).max(24)
			})
			.strict(),
		voice: z
			.object({
				polyphonic: z.boolean(),
				maxVoices: z.number().int().min(1).max(8),
				stealMode: VoiceStealModeSchema
			})
			.strict()
	})
	.strict();

export const PercussionInstrumentDefinitionSchema = z
	.object({
		kind: z.literal('percussion'),
		presetId: z.string().min(1).nullable(),
		oscillatorLayer: z
			.object({
				enabled: z.boolean(),
				pitchTracksNote: z.boolean(),
				waveform: PitchedWaveformSchema,
				startFrequencyHz: z.number().min(20).max(8_000),
				endFrequencyHz: z.number().min(20).max(8_000),
				pitchDecaySeconds: z.number().min(0.001).max(1),
				attackSeconds: z.number().min(0).max(0.5),
				decaySeconds: z.number().min(0.001).max(2),
				sustainLevel: z.number().min(0).max(1),
				releaseSeconds: z.number().min(0.001).max(2),
				gain: z.number().min(0).max(1)
			})
			.strict(),
		noiseLayer: z
			.object({
				enabled: z.boolean(),
				filterTracksNote: z.boolean(),
				filterType: FilterKindSchema,
				filterFrequencyHz: z.number().min(20).max(20_000),
				filterQ: z.number().min(0.1).max(20),
				attackSeconds: z.number().min(0).max(0.5),
				decaySeconds: z.number().min(0.001).max(2),
				sustainLevel: z.number().min(0).max(1),
				releaseSeconds: z.number().min(0.001).max(2),
				gain: z.number().min(0).max(1)
			})
			.strict(),
		rootMidiNote: z.number().int().min(0).max(127),
		chokeGroup: z.string().min(1).nullable()
	})
	.strict();

export const InstrumentDefinitionSchema = z.discriminatedUnion('kind', [
	PitchedInstrumentDefinitionSchema,
	PercussionInstrumentDefinitionSchema
]);
