import type { BuilderProject } from '@thinkbreak/audio-runtime';
import { z } from 'zod';
import { AudioChannelDefinitionSchema } from './channel.js';
import { CompiledSongSchema } from './song.js';

export const CompressorSettingsSchema = z
	.object({
		enabled: z.boolean(),
		thresholdDb: z.number().min(-60).max(0),
		kneeDb: z.number().min(0).max(40),
		ratio: z.number().min(1).max(20),
		attackSeconds: z.number().min(0).max(1),
		releaseSeconds: z.number().min(0).max(1)
	})
	.strict();

export const SourceMidiReferenceSchema = z
	.object({
		filename: z.string().min(1),
		byteLength: z.number().int().min(0),
		sha256: z.string().regex(/^[0-9a-f]{64}$/)
	})
	.strict();

export const MasterSettingsSchema = z
	.object({
		gain: z.number().min(0).max(1),
		compressor: CompressorSettingsSchema
	})
	.strict();

export const BuilderProjectSchema = z
	.object({
		schemaVersion: z
			.number()
			.int()
			.refine((value) => value === 1, { message: 'schemaVersion must equal 1' }),
		id: z.string().uuid(),
		name: z.string().min(1).max(200),
		createdAtMs: z.number().int().min(0),
		updatedAtMs: z.number().int().min(0),
		sync: z
			.object({
				serverRevision: z.number().int().min(0).nullable(),
				hasUnsyncedChanges: z.boolean(),
				lastSyncedAtMs: z.number().int().min(0).nullable()
			})
			.strict(),
		sourceMidi: SourceMidiReferenceSchema.nullable(),
		song: CompiledSongSchema.nullable(),
		channels: z.array(AudioChannelDefinitionSchema),
		transport: z
			.object({
				loopEnabled: z.boolean(),
				loopStartTick: z.number().int().min(0),
				loopEndTick: z.number().int().min(0),
				tempoMultiplier: z.number().min(0.25).max(4)
			})
			.strict(),
		master: MasterSettingsSchema,
		exportSettings: z
			.object({
				packageName: z.string().min(1),
				includeTests: z.boolean(),
				includeExample: z.boolean()
			})
			.strict()
	})
	.strict()
	.refine((project) => project.transport.loopStartTick <= project.transport.loopEndTick, {
		path: ['transport', 'loopStartTick'],
		message: 'loopStartTick must be less than or equal to loopEndTick'
	})
	.superRefine((project, context) => {
		if (project.song === null) return;
		const trackIds = new Set(project.song.tracks.map(({ id }) => id));
		project.channels.forEach((channel, index) => {
			if (channel.sourceTrackId !== null && !trackIds.has(channel.sourceTrackId)) {
				context.addIssue({
					code: 'custom',
					path: ['channels', index, 'sourceTrackId'],
					message: 'sourceTrackId must reference a track in song.tracks'
				});
			}
		});
	}) satisfies z.ZodType<BuilderProject>;
