import type { MidiImportWarning } from '@thinkbreak/midi-parser';

/**
 * Warnings from the last MIDI import, held for the session so `ImportWarningList` can render them
 * without threading the outcome through every intermediate component.
 */

let warnings = $state<MidiImportWarning[]>([]);
let sourceFilename = $state<string | null>(null);

export const importWarningsState = {
	get warnings(): readonly MidiImportWarning[] {
		return warnings;
	},
	get sourceFilename(): string | null {
		return sourceFilename;
	},

	set(next: readonly MidiImportWarning[], filename: string | null): void {
		warnings = [...next];
		sourceFilename = filename;
	},

	clear(): void {
		warnings = [];
		sourceFilename = null;
	}
};
