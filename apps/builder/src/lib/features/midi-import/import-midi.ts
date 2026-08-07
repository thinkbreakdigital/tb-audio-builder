import type {
	AudioChannelDefinition,
	BuilderProject,
	CompiledSong
} from '@thinkbreak/audio-runtime';
import { DEFAULT_AUDIO_LIMITS } from '@thinkbreak/audio-runtime';
import { BuilderProjectSchema, createEmptyProject, parseSafe } from '@thinkbreak/project-schema';
import type { MidiImportWarning } from '@thinkbreak/midi-parser';
import { loadMidiParser } from '$lib/client/midi/load-parser.js';
import { midiFileStore } from '$lib/client/midi/midi-file-store.js';
import { readMidiFile } from '$lib/client/midi/read-midi-file.js';
import { projectState } from '$lib/state/project.svelte.js';
import { statusState } from '$lib/state/status.svelte.js';
import { uiState } from '$lib/state/ui.svelte.js';
import { reconcileChannels } from '../channels/channel-assignment.js';

export interface ImportOutcome {
	song: CompiledSong;
	channels: AudioChannelDefinition[];
	warnings: readonly MidiImportWarning[];
	preservedChannelCount: number;
	newChannelCount: number;
	droppedChannelCount: number;
}

function projectNameFromFilename(filename: string): string {
	return filename.replace(/\.(?:mid|midi)$/i, '') || filename;
}

function cloneProject(project: BuilderProject): BuilderProject {
	return structuredClone(project);
}

export async function importMidiIntoProject(file: File): Promise<ImportOutcome> {
	const { compileMidiFile, MidiImportError } = await loadMidiParser();
	const read = await readMidiFile(file);
	const compiled = compileMidiFile({ fileBytes: read.fileBytes, filename: read.filename });
	const { song, warnings, suggestions } = compiled;

	if (song.tracks.length > DEFAULT_AUDIO_LIMITS.maxTracks) {
		throw new MidiImportError(
			read.filename,
			`contains ${song.tracks.length} tracks; the maximum supported is ${DEFAULT_AUDIO_LIMITS.maxTracks}.`
		);
	}

	const existingProject = projectState.project;
	const existingChannels = projectState.channels;
	const reconciliation = reconcileChannels({ song, existingChannels, suggestions });
	const candidate = existingProject
		? cloneProject(existingProject)
		: createEmptyProject({ name: projectNameFromFilename(read.filename) });

	candidate.song = song;
	candidate.channels = reconciliation.channels;
	candidate.sourceMidi = {
		filename: read.filename,
		byteLength: read.byteLength,
		sha256: read.sha256
	};
	candidate.transport = {
		...candidate.transport,
		loopStartTick: 0,
		loopEndTick: song.durationTicks
	};
	candidate.updatedAtMs = Date.now();
	candidate.sync.hasUnsyncedChanges = true;

	const validated = parseSafe(
		BuilderProjectSchema,
		candidate,
		'Unable to validate imported project'
	);
	if (!validated.ok) throw validated.error;

	midiFileStore.put(read.sha256, read.filename, read.fileBytes);
	projectState.setProject(validated.value);

	const detail =
		reconciliation.droppedChannelCount > 0
			? `${reconciliation.droppedChannelCount} channel(s) with no matching MIDI track were removed.`
			: undefined;
	statusState.push(
		'info',
		`Imported "${read.filename}": ${reconciliation.channels.length} channels (${reconciliation.preservedChannelCount} reused, ${reconciliation.newChannelCount} new).`,
		detail
	);
	if (warnings.length > 0) {
		statusState.push(
			'warning',
			`Imported MIDI with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`
		);
	}

	const selectedChannel = reconciliation.channels.find(
		(channel) => channel.role !== 'metadata' && channel.role !== 'ignored'
	);
	uiState.setSelectedChannelId(selectedChannel?.id ?? null);

	return {
		song,
		warnings,
		...reconciliation
	};
}
