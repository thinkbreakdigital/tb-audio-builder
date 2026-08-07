import { loadMidiParser } from './load-parser.js';

function formatMegabytes(byteLength: number): string {
	return `${(byteLength / (1024 * 1024)).toFixed(1)} MB`;
}

function toSha256Hex(digest: ArrayBuffer): string {
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function readMidiFile(file: File): Promise<{
	fileBytes: ArrayBuffer;
	filename: string;
	byteLength: number;
	sha256: string;
}> {
	const { MAX_MIDI_FILE_BYTES, MidiImportError, SUPPORTED_MIDI_EXTENSIONS } =
		await loadMidiParser();
	const filename = file.name;
	const extensionStart = filename.lastIndexOf('.');
	const extension = (extensionStart >= 0 ? filename.slice(extensionStart) : '').toLowerCase();
	if (
		!SUPPORTED_MIDI_EXTENSIONS.includes(extension as (typeof SUPPORTED_MIDI_EXTENSIONS)[number])
	) {
		throw new MidiImportError(
			filename,
			`has an unsupported extension "${extension || '(none)'}"; import requires .mid or .midi.`
		);
	}

	if (file.size > MAX_MIDI_FILE_BYTES) {
		throw new MidiImportError(
			filename,
			`is ${formatMegabytes(file.size)}; the maximum supported size is ${formatMegabytes(MAX_MIDI_FILE_BYTES)}.`
		);
	}

	let fileBytes: ArrayBuffer;
	try {
		fileBytes = await file.arrayBuffer();
	} catch (cause) {
		throw new MidiImportError(filename, 'could not be read.', cause);
	}

	if (typeof crypto === 'undefined' || crypto.subtle === undefined) {
		throw new MidiImportError(
			filename,
			'MIDI import needs a secure context (HTTPS or localhost) to calculate the file hash.'
		);
	}

	try {
		const digest = await crypto.subtle.digest('SHA-256', fileBytes);
		return {
			fileBytes,
			filename,
			byteLength: fileBytes.byteLength,
			sha256: toSha256Hex(digest)
		};
	} catch (cause) {
		throw new MidiImportError(filename, 'could not be hashed for MIDI import.', cause);
	}
}
