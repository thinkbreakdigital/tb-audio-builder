import type { AudioChannelDefinition, ChannelMixSettings } from '@thinkbreak/audio-runtime';
import { z } from 'zod';
import { InstrumentDefinitionSchema } from './instrument';

export const ChannelRoleSchema = z.enum(['pitched', 'percussion', 'ignored', 'metadata']);

export const ChannelMixSettingsSchema = z
	.object({
		gain: z.number().min(0).max(1),
		pan: z.number().min(-1).max(1),
		muted: z.boolean(),
		soloed: z.boolean()
	})
	.strict();

export const AudioChannelDefinitionSchema = z
	.object({
		id: z.string().uuid(),
		name: z.string().min(1).max(200),
		role: ChannelRoleSchema,
		sourceTrackId: z.string().uuid().nullable(),
		enabled: z.boolean(),
		instrument: InstrumentDefinitionSchema.nullable(),
		mix: ChannelMixSettingsSchema
	})
	.strict();
