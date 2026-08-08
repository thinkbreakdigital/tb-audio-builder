import type { BuilderProject } from '@thinkbreak/audio-runtime';
import { z } from 'zod';
import { AudioChannelDefinitionSchema } from './channel.js';
import { ProjectOrChannelNameSchema } from './name.js';
import { CompiledSongSchema } from './song.js';

const TransportSchema = z
	.object({
		loopEnabled: z.boolean(),
		loopStartTick: z.number().int().min(0),
		loopEndTick: z.number().int().min(0),
		tempoMultiplier: z.number().min(0.25).max(4)
	})
	.strict()
	.refine((transport) => transport.loopStartTick <= transport.loopEndTick, {
		path: ['loopStartTick'],
		message: 'loopStartTick must be less than or equal to loopEndTick'
	});

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
		name: ProjectOrChannelNameSchema,
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
		transport: TransportSchema,
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
	.superRefine((project, context) => {
		const channelIds = new Set<string>();
		const sourceTrackIds = new Set<string>();
		project.channels.forEach((channel, index) => {
			if (channelIds.has(channel.id)) {
				context.addIssue({
					code: 'custom',
					path: ['channels', index, 'id'],
					message: 'channel id must be unique within a project'
				});
			}
			channelIds.add(channel.id);
			if (channel.sourceTrackId !== null && sourceTrackIds.has(channel.sourceTrackId)) {
				context.addIssue({
					code: 'custom',
					path: ['channels', index, 'sourceTrackId'],
					message: 'sourceTrackId must be assigned to at most one channel'
				});
			}
			if (channel.sourceTrackId !== null) sourceTrackIds.add(channel.sourceTrackId);
		});

		if (project.song === null) {
			if (project.transport.loopEnabled) {
				context.addIssue({
					code: 'custom',
					path: ['transport', 'loopEnabled'],
					message: 'enabled loop requires a song duration'
				});
			}
			if (project.transport.loopStartTick !== 0 || project.transport.loopEndTick !== 0) {
				context.addIssue({
					code: 'custom',
					path: ['transport', 'loopStartTick'],
					message: 'loop bounds must be zero when no song is loaded'
				});
			}
			return;
		}
		if (project.transport.loopEndTick > project.song.durationTicks) {
			context.addIssue({
				code: 'custom',
				path: ['transport', 'loopEndTick'],
				message: 'loop bounds must be contained within song.durationTicks'
			});
		}
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
