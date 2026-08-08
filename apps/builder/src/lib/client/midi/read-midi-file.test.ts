import { describe, expect, it, vi } from 'vitest';

vi.mock('./load-parser.js', () => ({
	loadMidiParser: vi.fn()
}));

class FixtureMidiImportError extends Error {
	constructor(filename: string, message: string, cause?: unknown) {
		super(`Unable to import MIDI file "${filename}": ${message}`);
		this.name = 'MidiImportError';
		this.cause = cause;
	}
}

describe('readMidiFile', () => {
	it('rejects oversized bytes after reading even when File.size is misleading', async () => {
		const { loadMidiParser } = await import('./load-parser.js');
		vi.mocked(loadMidiParser).mockResolvedValue({
			MAX_MIDI_FILE_BYTES: 5 * 1024 * 1024,
			MidiImportError: FixtureMidiImportError,
			SUPPORTED_MIDI_EXTENSIONS: ['.mid', '.midi']
		} as never);
		const { readMidiFile } = await import('./read-midi-file.js');
		const misleadingFile = {
			name: 'misleading.mid',
			size: 1,
			arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5 * 1024 * 1024 + 1))
		} as unknown as File;

		await expect(readMidiFile(misleadingFile)).rejects.toThrow(/after reading/);
	});
});
