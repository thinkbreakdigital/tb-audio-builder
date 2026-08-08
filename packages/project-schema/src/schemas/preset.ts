import type {
	BuilderProject,
	ChannelMixSettings,
	ChannelRole,
	InstrumentDefinition
} from '@thinkbreak/audio-runtime';
import { z } from 'zod';
import { AudioChannelDefinitionFieldsSchema, validateChannelInstrumentRole } from './channel.js';
import { InstrumentDefinitionSchema } from './instrument.js';
import { MasterSettingsSchema } from './project.js';

const BuiltInIdSchema = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
		message: 'built-in id must be a stable lowercase slug'
	})
	.refine((value) => !z.string().uuid().safeParse(value).success, {
		message: 'built-in id must be a stable lowercase slug, not a UUID'
	});
const CustomIdSchema = z.string().uuid();

function validatePresetId(value: { id: string; builtIn: boolean }, context: z.RefinementCtx): void {
	const result = (value.builtIn ? BuiltInIdSchema : CustomIdSchema).safeParse(value.id);
	if (!result.success) {
		context.addIssue({
			code: 'custom',
			path: ['id'],
			message: result.error.issues[0]?.message ?? 'id is invalid'
		});
	}
}

export interface InstrumentPreset {
	id: string;
	name: string;
	type: 'pitched' | 'percussion';
	definition: InstrumentDefinition;
	builtIn: boolean;
	createdAtMs: number;
	updatedAtMs: number;
}

export interface SoundSetChannel {
	name: string;
	role: ChannelRole;
	enabled: boolean;
	instrument: InstrumentDefinition | null;
	mix: ChannelMixSettings;
}

export interface SoundSet {
	schemaVersion: number;
	id: string;
	name: string;
	builtIn: boolean;
	channels: SoundSetChannel[];
	master: BuilderProject['master'];
	createdAtMs: number;
	updatedAtMs: number;
}

export const InstrumentPresetSchema: z.ZodType<InstrumentPreset> = z
	.object({
		id: z.string().min(1).max(100),
		name: z.string().min(1).max(200),
		type: z.enum(['pitched', 'percussion']),
		definition: InstrumentDefinitionSchema,
		builtIn: z.boolean(),
		createdAtMs: z.number().int().min(0),
		updatedAtMs: z.number().int().min(0)
	})
	.strict()
	.refine((preset) => preset.type === preset.definition.kind, {
		path: ['type'],
		message: 'type must match definition.kind'
	})
	.superRefine(validatePresetId);

// Song-bound channel identity is deliberately omitted from reusable sound sets.
export const SoundSetChannelSchema: z.ZodType<SoundSetChannel> =
	AudioChannelDefinitionFieldsSchema.omit({
		id: true,
		sourceTrackId: true
	}).superRefine(validateChannelInstrumentRole);

export const SoundSetSchema: z.ZodType<SoundSet> = z
	.object({
		schemaVersion: z.literal(1),
		id: z.string().min(1).max(100),
		name: z.string().min(1).max(200),
		builtIn: z.boolean(),
		channels: z.array(SoundSetChannelSchema).min(1),
		master: MasterSettingsSchema,
		createdAtMs: z.number().int().min(0),
		updatedAtMs: z.number().int().min(0)
	})
	.strict()
	.superRefine(validatePresetId);
