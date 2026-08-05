import type {
	AudioChannelDefinition,
	BuilderProject,
	CompiledSong,
	CompiledTrack,
	PercussionInstrumentDefinition,
	PitchedInstrumentDefinition
} from '@thinkbreak/audio-runtime';
import { expect, test } from 'vitest';
import type { z } from 'zod';
import {
	AudioChannelDefinitionSchema,
	BuilderProjectSchema,
	CompiledSongSchema,
	CompiledTrackSchema,
	PercussionInstrumentDefinitionSchema,
	PitchedInstrumentDefinitionSchema
} from '../src';

type SongOutput = z.infer<typeof CompiledSongSchema>;
type TrackOutput = z.infer<typeof CompiledTrackSchema>;
type PitchedOutput = z.infer<typeof PitchedInstrumentDefinitionSchema>;
type PercussionOutput = z.infer<typeof PercussionInstrumentDefinitionSchema>;
type ChannelOutput = z.infer<typeof AudioChannelDefinitionSchema>;
type ProjectOutput = z.infer<typeof BuilderProjectSchema>;

const _songForward: SongOutput = {} as CompiledSong;
const _songBackward: CompiledSong = {} as SongOutput;
const _trackForward: TrackOutput = {} as CompiledTrack;
const _trackBackward: CompiledTrack = {} as TrackOutput;
const _pitchedForward: PitchedOutput = {} as PitchedInstrumentDefinition;
const _pitchedBackward: PitchedInstrumentDefinition = {} as PitchedOutput;
const _percussionForward: PercussionOutput = {} as PercussionInstrumentDefinition;
const _percussionBackward: PercussionInstrumentDefinition = {} as PercussionOutput;
const _channelForward: ChannelOutput = {} as AudioChannelDefinition;
const _channelBackward: AudioChannelDefinition = {} as ChannelOutput;
const _projectForward: ProjectOutput = {} as BuilderProject;
const _projectBackward: BuilderProject = {} as ProjectOutput;

void [
	_songForward,
	_songBackward,
	_trackForward,
	_trackBackward,
	_pitchedForward,
	_pitchedBackward,
	_percussionForward,
	_percussionBackward,
	_channelForward,
	_channelBackward,
	_projectForward,
	_projectBackward
];

test('runtime types conform to schema output in both directions', () => {
	expect(true).toBe(true);
});
