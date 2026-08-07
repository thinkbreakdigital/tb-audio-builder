import type { CompiledSong, CompiledTrack } from '@thinkbreak/audio-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/client/midi/read-midi-file.js', () => ({
	readMidiFile: vi.fn()
}));

vi.mock('@thinkbreak/midi-parser', async (importOriginal) => {
	const original = await importOriginal<typeof import('@thinkbreak/midi-parser')>();
	return { ...original, compileMidiFile: vi.fn() };
});

function makeTrack(id: string, sourceTrackName: string): CompiledTrack {
	return {
		id: `00000000-0000-4000-8000-${String(Number(id) + 1).padStart(12, '0')}`,
		sourceTrackName,
		midiChannel: 0,
		notes: [{ tick: 0, durationTicks: 120, midiNote: 60, velocity: 0.8 }],
		pitchBends: [],
		modulationEvents: [],
		volumeEvents: []
	};
}

function makeSong(trackCount = 1): CompiledSong {
	return {
		schemaVersion: 1,
		id: crypto.randomUUID(),
		sourceFilename: 'fixture.mid',
		ticksPerQuarterNote: 480,
		durationTicks: 960,
		tempoChanges: [{ tick: 0, bpm: 120 }],
		timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
		markers: [],
		tracks: Array.from({ length: trackCount }, (_, index) =>
			makeTrack(String(index), `Track ${index + 1}`)
		)
	};
}

function readResult(filename: string, sha256 = 'a'.repeat(64)) {
	return {
		fileBytes: new ArrayBuffer(4),
		filename,
		byteLength: 4,
		sha256
	};
}

async function loadImportModules() {
	const importModule = await import('./import-midi.js');
	const readModule = await import('$lib/client/midi/read-midi-file.js');
	const parserModule = await import('@thinkbreak/midi-parser');
	const projectModule = await import('$lib/state/project.svelte.js');
	const statusModule = await import('$lib/state/status.svelte.js');
	const uiModule = await import('$lib/state/ui.svelte.js');
	const storeModule = await import('$lib/client/midi/midi-file-store.js');
	return {
		importModule,
		readModule,
		parserModule,
		projectModule,
		statusModule,
		uiModule,
		storeModule
	};
}

beforeEach(() => {
	vi.resetModules();
});

describe('importMidiIntoProject', () => {
	it('populates the project and stores the source MIDI', async () => {
		const modules = await loadImportModules();
		const readMock = vi.mocked(modules.readModule.readMidiFile);
		const compileMock = vi.mocked(modules.parserModule.compileMidiFile);
		const song = makeSong();
		readMock.mockResolvedValue(readResult('song.mid'));
		compileMock.mockReturnValue({ song, warnings: [], suggestions: [] });

		const outcome = await modules.importModule.importMidiIntoProject(new File([], 'song.mid'));
		const project = modules.projectModule.projectState.project;

		expect(outcome.song).toBe(song);
		expect(project?.song).toEqual(song);
		expect(project?.channels).toEqual(outcome.channels);
		expect(project?.sourceMidi).toEqual({
			filename: 'song.mid',
			byteLength: 4,
			sha256: 'a'.repeat(64)
		});
		expect(project?.transport.loopEndTick).toBe(song.durationTicks);
		expect(modules.storeModule.midiFileStore.get('a'.repeat(64))).not.toBeNull();
	});

	it('rejects a 17-track song without replacing the project', async () => {
		const modules = await loadImportModules();
		const readMock = vi.mocked(modules.readModule.readMidiFile);
		const compileMock = vi.mocked(modules.parserModule.compileMidiFile);
		modules.projectModule.projectState.createNew('Existing');
		const before = structuredClone(modules.projectModule.projectState.project);
		readMock.mockResolvedValue(readResult('too-many.mid'));
		compileMock.mockReturnValue({ song: makeSong(17), warnings: [], suggestions: [] });

		await expect(
			modules.importModule.importMidiIntoProject(new File([], 'too-many.mid'))
		).rejects.toThrow(/17 tracks.*16/);
		expect(modules.projectModule.projectState.project).toEqual(before);
	});

	it('leaves both project and file store untouched when candidate validation fails', async () => {
		const modules = await loadImportModules();
		const readMock = vi.mocked(modules.readModule.readMidiFile);
		const compileMock = vi.mocked(modules.parserModule.compileMidiFile);
		modules.projectModule.projectState.createNew('Existing');
		const beforeProject = structuredClone(modules.projectModule.projectState.project);
		modules.storeModule.midiFileStore.put('b'.repeat(64), 'old.mid', new ArrayBuffer(2));
		readMock.mockResolvedValue(readResult('invalid.mid', 'not-a-sha256'));
		compileMock.mockReturnValue({ song: makeSong(), warnings: [], suggestions: [] });

		await expect(
			modules.importModule.importMidiIntoProject(new File([], 'invalid.mid'))
		).rejects.toThrow(/Unable to validate imported project/);
		expect(modules.projectModule.projectState.project).toEqual(beforeProject);
		expect(modules.storeModule.midiFileStore.get('b'.repeat(64))).toEqual({
			filename: 'old.mid',
			fileBytes: expect.any(ArrayBuffer)
		});
		expect(modules.storeModule.midiFileStore.get('not-a-sha256')).toBeNull();
	});

	it('creates a project named after the file stem when none is open', async () => {
		const modules = await loadImportModules();
		const readMock = vi.mocked(modules.readModule.readMidiFile);
		const compileMock = vi.mocked(modules.parserModule.compileMidiFile);
		readMock.mockResolvedValue(readResult('My Song.MIDI'));
		compileMock.mockReturnValue({ song: makeSong(), warnings: [], suggestions: [] });

		await modules.importModule.importMidiIntoProject(new File([], 'My Song.MIDI'));

		expect(modules.projectModule.projectState.project?.name).toBe('My Song');
	});

	it('returns compiler warnings and pushes exactly one warning status', async () => {
		const modules = await loadImportModules();
		const readMock = vi.mocked(modules.readModule.readMidiFile);
		const compileMock = vi.mocked(modules.parserModule.compileMidiFile);
		const warning = {
			sourceFilename: 'song.mid',
			trackName: 'Track 1',
			trackIndex: 0,
			eventType: 'unknown',
			tick: 12,
			message: 'Ignored event',
			suggestedAction: null
		};
		readMock.mockResolvedValue(readResult('song.mid'));
		compileMock.mockReturnValue({ song: makeSong(), warnings: [warning], suggestions: [] });

		const outcome = await modules.importModule.importMidiIntoProject(new File([], 'song.mid'));

		expect(outcome.warnings).toEqual([warning]);
		expect(
			modules.statusModule.statusState.messages.filter((message) => message.level === 'warning')
		).toHaveLength(1);
		expect(modules.uiModule.uiState.selectedChannelId).toBe(outcome.channels[0]?.id ?? null);
	});
});
