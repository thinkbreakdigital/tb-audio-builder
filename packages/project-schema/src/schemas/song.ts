import type {
	CompiledNote,
	CompiledSong,
	CompiledTrack,
	ModulationEvent,
	PitchBendEvent,
	SongMarker,
	TempoChange,
	TimeSignatureChange,
	TrackVolumeEvent
} from '@thinkbreak/audio-runtime';
import { z } from 'zod';

const TickSchema = z.number().int().min(0);
const UnitValueSchema = z.number().min(0).max(1);

export const TempoChangeSchema = z
	.object({ tick: TickSchema, bpm: z.number().positive() })
	.strict();

export const TimeSignatureChangeSchema = z
	.object({
		tick: TickSchema,
		numerator: z.number().int().positive(),
		denominator: z.number().int().positive()
	})
	.strict();

export const SongMarkerSchema = z
	.object({ tick: TickSchema, name: z.string().min(1).max(200) })
	.strict();

export const CompiledNoteSchema = z
	.object({
		tick: TickSchema,
		durationTicks: z.number().int().min(1),
		midiNote: z.number().int().min(0).max(127),
		velocity: UnitValueSchema
	})
	.strict();

export const PitchBendEventSchema = z
	.object({ tick: TickSchema, value: z.number().min(-1).max(1) })
	.strict();

export const ModulationEventSchema = z
	.object({ tick: TickSchema, value: UnitValueSchema })
	.strict();

export const TrackVolumeEventSchema = z
	.object({ tick: TickSchema, value: UnitValueSchema })
	.strict();

function sortedArray<T>(
	itemSchema: z.ZodType<T>,
	name: string,
	compare: (previous: T, current: T) => number
): z.ZodType<T[]> {
	return z.array(itemSchema).superRefine((items, context) => {
		for (let index = 1; index < items.length; index += 1) {
			const previous = items[index - 1];
			const current = items[index];
			if (previous !== undefined && current !== undefined && compare(previous, current) > 0) {
				context.addIssue({
					code: 'custom',
					path: [index],
					message: `${name} is out of order at index ${index}`
				});
				break;
			}
		}
	});
}

const NotesSchema = sortedArray(CompiledNoteSchema, 'notes', (left, right) =>
	left.tick === right.tick ? left.midiNote - right.midiNote : left.tick - right.tick
);
const PitchBendsSchema = sortedArray(
	PitchBendEventSchema,
	'pitchBends',
	(left, right) => left.tick - right.tick
);
const ModulationEventsSchema = sortedArray(
	ModulationEventSchema,
	'modulationEvents',
	(left, right) => left.tick - right.tick
);
const VolumeEventsSchema = sortedArray(
	TrackVolumeEventSchema,
	'volumeEvents',
	(left, right) => left.tick - right.tick
);

export const CompiledTrackSchema = z
	.object({
		id: z.string().uuid(),
		sourceTrackName: z.string().min(1).max(200),
		midiChannel: z.number().int().min(-1).max(15),
		notes: NotesSchema,
		pitchBends: PitchBendsSchema,
		modulationEvents: ModulationEventsSchema,
		volumeEvents: VolumeEventsSchema
	})
	.strict();

const TempoChangesSchema = sortedArray(
	TempoChangeSchema,
	'tempoChanges',
	(left, right) => left.tick - right.tick
);
const TimeSignaturesSchema = sortedArray(
	TimeSignatureChangeSchema,
	'timeSignatures',
	(left, right) => left.tick - right.tick
);

export const CompiledSongSchema = z
	.object({
		schemaVersion: z.number().int(),
		id: z.string().uuid(),
		sourceFilename: z.string().min(1),
		ticksPerQuarterNote: z.number().int().min(1),
		durationTicks: z.number().int().min(0),
		tempoChanges: TempoChangesSchema,
		timeSignatures: TimeSignaturesSchema,
		markers: z.array(SongMarkerSchema),
		tracks: z.array(CompiledTrackSchema)
	})
	.strict()
	.refine((song) => song.tempoChanges.some(({ tick }) => tick === 0), {
		path: ['tempoChanges'],
		message: 'tempoChanges must contain an entry at tick 0'
	})
	.refine((song) => song.timeSignatures.some(({ tick }) => tick === 0), {
		path: ['timeSignatures'],
		message: 'timeSignatures must contain an entry at tick 0'
	});
