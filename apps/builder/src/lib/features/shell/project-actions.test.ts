import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadModules() {
	const actions = await import('./project-actions.js');
	const project = await import('$lib/state/project.svelte.js');
	const store = await import('$lib/client/midi/midi-file-store.js');
	const ui = await import('$lib/state/ui.svelte.js');
	return { actions, project, store, ui };
}

beforeEach(() => {
	vi.resetModules();
});

describe('createNewProject', () => {
	it('releases the replaced active MIDI blob only after creating the new project', async () => {
		const modules = await loadModules();
		const previousSha256 = 'f'.repeat(64);
		modules.store.midiFileStore.put(previousSha256, 'old.mid', new ArrayBuffer(1));
		modules.project.projectState.createNew('Existing');
		const current = modules.project.projectState.snapshot()!;
		current.sourceMidi = {
			filename: 'old.mid',
			byteLength: 1,
			sha256: previousSha256
		};
		modules.project.projectState.setProject(current);
		modules.ui.uiState.setSelectedChannelId('selected-channel');

		modules.actions.createNewProject();

		expect(modules.project.projectState.project?.name).toBe('Untitled project');
		expect(modules.project.projectState.project?.sourceMidi).toBeNull();
		expect(modules.store.midiFileStore.has(previousSha256)).toBe(false);
		expect(modules.ui.uiState.selectedChannelId).toBeNull();
	});
});
