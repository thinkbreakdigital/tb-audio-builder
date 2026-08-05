/**
 * Song data produced by MIDI import.
 *
 * Timing is preserved in ticks. Seconds are derived at playback time through the tempo map,
 * never stored.
 */

export interface CompiledSong {
	schemaVersion: number;
	id: string;
	sourceFilename: string;
	ticksPerQuarterNote: number;
	durationTicks: number;
	tempoChanges: TempoChange[]; // sorted by tick; always contains an entry at tick 0
	timeSignatures: TimeSignatureChange[]; // sorted by tick; always contains an entry at tick 0
	markers: SongMarker[];
	tracks: CompiledTrack[];
}

export interface TempoChange {
	tick: number;
	bpm: number;
}

export interface TimeSignatureChange {
	tick: number;
	numerator: number;
	denominator: number;
}

export interface SongMarker {
	tick: number;
	name: string;
}

export interface CompiledTrack {
	id: string;
	sourceTrackName: string;
	midiChannel: number; // 0-15; -1 when the source track carried no channel
	notes: CompiledNote[]; // sorted by tick, then by midiNote
	pitchBends: PitchBendEvent[]; // sorted by tick
	modulationEvents: ModulationEvent[]; // sorted by tick
	volumeEvents: TrackVolumeEvent[]; // sorted by tick
}

export interface CompiledNote {
	tick: number;
	durationTicks: number; // always >= 1
	midiNote: number; // 0-127
	velocity: number; // 0..1
}

export interface PitchBendEvent {
	tick: number;
	value: number; // -1..1, normalized from the 14-bit MIDI value
}

export interface ModulationEvent {
	tick: number;
	value: number; // 0..1, from CC1
}

export interface TrackVolumeEvent {
	tick: number;
	value: number; // 0..1, from CC7
}
