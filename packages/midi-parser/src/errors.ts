export class MidiImportError extends Error {
	readonly filename: string;
	readonly cause?: unknown;

	constructor(filename: string, message: string, cause?: unknown) {
		super(`Unable to import MIDI file "${filename}": ${message}`);
		this.name = 'MidiImportError';
		this.filename = filename;
		this.cause = cause;
	}
}
