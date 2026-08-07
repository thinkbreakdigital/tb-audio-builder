const files = new Map<string, { filename: string; fileBytes: ArrayBuffer }>();

export const midiFileStore = {
	put(sha256: string, filename: string, fileBytes: ArrayBuffer): void {
		files.set(sha256, { filename, fileBytes });
	},

	get(sha256: string): { filename: string; fileBytes: ArrayBuffer } | null {
		return files.get(sha256) ?? null;
	},

	clear(): void {
		files.clear();
	}
};
