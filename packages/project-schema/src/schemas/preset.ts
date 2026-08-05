import type {
	BuilderProject,
	ChannelMixSettings,
	ChannelRole,
	InstrumentDefinition
} from '@thinkbreak/audio-runtime';
import { z } from 'zod';
import { AudioChannelDefinitionSchema } from './channel';
import { InstrumentDefinitionSchema } from './instrument';
import { MasterSettingsSchema } from './project';

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
	});

// Song-bound channel identity is deliberately omitted from reusable sound sets.
export const SoundSetChannelSchema: z.ZodType<SoundSetChannel> = AudioChannelDefinitionSchema.omit({
	id: true,
	sourceTrackId: true
});

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
	.refine(
		(soundSet) => {
			const names = soundSet.channels.map(({ name }) => name.trim().toLocaleLowerCase());
			return new Set(names).size === names.length;
		},
		{ path: ['channels'], message: 'channel names must be unique after case-insensitive trimming' }
	);
