import { z } from 'zod';
import { InstrumentDefinitionSchema } from './instrument.js';
import { ProjectOrChannelNameSchema } from './name.js';

export const ChannelRoleSchema = z.enum(['pitched', 'percussion', 'ignored', 'metadata']);

export const ChannelMixSettingsSchema = z
	.object({
		gain: z.number().min(0).max(1),
		pan: z.number().min(-1).max(1),
		muted: z.boolean(),
		soloed: z.boolean()
	})
	.strict();

export const AudioChannelDefinitionFieldsSchema = z
	.object({
		id: z.string().uuid(),
		name: ProjectOrChannelNameSchema,
		role: ChannelRoleSchema,
		sourceTrackId: z.string().uuid().nullable(),
		enabled: z.boolean(),
		instrument: InstrumentDefinitionSchema.nullable(),
		mix: ChannelMixSettingsSchema
	})
	.strict();

export function validateChannelInstrumentRole(
	channel: {
		role: z.infer<typeof ChannelRoleSchema>;
		instrument: z.infer<typeof InstrumentDefinitionSchema> | null;
	},
	context: z.RefinementCtx
): void {
	const expectedInstrumentKind =
		channel.role === 'pitched' || channel.role === 'percussion' ? channel.role : null;
	if (expectedInstrumentKind === null) {
		if (channel.instrument !== null) {
			context.addIssue({
				code: 'custom',
				path: ['instrument'],
				message: `${channel.role} channels must not have an instrument`
			});
		}
		return;
	}

	if (channel.instrument?.kind !== expectedInstrumentKind) {
		context.addIssue({
			code: 'custom',
			path: ['instrument'],
			message: `${expectedInstrumentKind} channels must have a matching ${expectedInstrumentKind} instrument`
		});
	}
}

export const AudioChannelDefinitionSchema = AudioChannelDefinitionFieldsSchema.superRefine(
	validateChannelInstrumentRole
);
