import { ProjectValidationError } from '@thinkbreak/project-schema';
import { loadMidiParser } from '$lib/client/midi/load-parser.js';
import { statusState } from '$lib/state/status.svelte.js';
import { importMidiIntoProject } from './import-midi.js';
import { importWarningsState } from './import-warnings.svelte.js';

/**
 * Shared entry point for the two UI call sites that trigger an import (the drop zone and the
 * project bar), so both get identical error handling. `import-midi.ts` already pushes the
 * success and warning-count status messages; this wrapper only reports failures and records the
 * warnings for `ImportWarningList`.
 */
export async function runMidiImport(file: File): Promise<boolean> {
	try {
		const outcome = await importMidiIntoProject(file);
		importWarningsState.set(outcome.warnings, file.name);
		return true;
	} catch (error) {
		const { MidiImportError } = await loadMidiParser();
		if (error instanceof MidiImportError || error instanceof ProjectValidationError) {
			statusState.push('error', error.message);
		} else {
			const message = error instanceof Error ? error.message : String(error);
			statusState.push('error', `Unable to import MIDI file "${file.name}": ${message}`);
		}
		return false;
	}
}
