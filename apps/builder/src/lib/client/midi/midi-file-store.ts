export interface StoredMidiFile {
	filename: string;
	fileBytes: ArrayBuffer;
}

export interface MidiFileStore {
	put(sha256: string, filename: string, fileBytes: ArrayBuffer): void;
	get(sha256: string): StoredMidiFile | null;
	has(sha256: string): boolean;
	delete(sha256: string): void;
	clear(): void;
}

const files = new Map<string, StoredMidiFile>();

function cloneBuffer(fileBytes: ArrayBuffer): ArrayBuffer {
	return fileBytes.slice(0);
}

export const midiFileStore: MidiFileStore = {
	put(sha256: string, filename: string, fileBytes: ArrayBuffer): void {
		files.set(sha256, { filename, fileBytes: cloneBuffer(fileBytes) });
	},

	get(sha256: string): StoredMidiFile | null {
		const file = files.get(sha256);
		return file === undefined
			? null
			: { filename: file.filename, fileBytes: cloneBuffer(file.fileBytes) };
	},

	has(sha256: string): boolean {
		return files.has(sha256);
	},

	delete(sha256: string): void {
		files.delete(sha256);
	},

	clear(): void {
		files.clear();
	}
};
