import { midiFileStore } from '$lib/client/midi/midi-file-store.js';
import { projectState } from '$lib/state/project.svelte.js';
import { statusState } from '$lib/state/status.svelte.js';
import { uiState } from '$lib/state/ui.svelte.js';

export const NEW_PROJECT_NAME = 'Untitled project';

/** Creates a validated empty project, then releases the MIDI blob the replaced project owned. */
export function createNewProject(): void {
	const priorMidiSha256 = projectState.project?.sourceMidi?.sha256 ?? null;
	projectState.createNew(NEW_PROJECT_NAME);
	if (priorMidiSha256 !== null) midiFileStore.delete(priorMidiSha256);
	uiState.setSelectedChannelId(null);
	statusState.push('info', `Created project "${NEW_PROJECT_NAME}".`);
}
