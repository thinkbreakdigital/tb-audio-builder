import type { AudioChannelDefinition } from './channel.js';
import type { CompiledSong } from './song.js';

export interface CompressorSettings {
	enabled: boolean;
	thresholdDb: number; // -60..0
	kneeDb: number; // 0..40
	ratio: number; // 1..20
	attackSeconds: number; // 0..1
	releaseSeconds: number; // 0..1
}

export interface SourceMidiReference {
	filename: string;
	byteLength: number;
	sha256: string; // lowercase hex of the original file bytes
}

/**
 * Fully JSON-serializable. The original MIDI file bytes are stored separately and referenced by
 * `sourceMidi.sha256`; the project access token is never part of this document.
 */
export interface BuilderProject {
	schemaVersion: number;
	id: string;
	name: string;
	createdAtMs: number;
	updatedAtMs: number;

	sync: {
		serverRevision: number | null;
		hasUnsyncedChanges: boolean;
		lastSyncedAtMs: number | null;
	};

	sourceMidi: SourceMidiReference | null;
	song: CompiledSong | null;
	channels: AudioChannelDefinition[];

	transport: {
		loopEnabled: boolean;
		loopStartTick: number;
		loopEndTick: number;
		tempoMultiplier: number; // 0.25..4
	};

	master: {
		gain: number; // 0..1
		compressor: CompressorSettings;
	};

	exportSettings: {
		packageName: string;
		includeTests: boolean;
		includeExample: boolean;
	};
}
