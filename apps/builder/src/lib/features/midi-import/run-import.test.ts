import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./import-midi.js', () => ({
	importMidiIntoProject: vi.fn()
}));

vi.mock('$lib/client/midi/load-parser.js', () => ({
	loadMidiParser: vi.fn()
}));

async function loadModules() {
	const runModule = await import('./run-import.js');
	const importModule = await import('./import-midi.js');
	const parserModule = await import('$lib/client/midi/load-parser.js');
	const statusModule = await import('$lib/state/status.svelte.js');
	return { runModule, importModule, parserModule, statusModule };
}

beforeEach(() => {
	vi.resetModules();
});

describe('runMidiImport', () => {
	it('reports one error and returns false when the lazy parser loader fails', async () => {
		const modules = await loadModules();
		vi.mocked(modules.importModule.importMidiIntoProject).mockRejectedValue(
			new Error('MIDI parser chunk could not be loaded')
		);

		await expect(modules.runModule.runMidiImport(new File([], 'song.mid'))).resolves.toBe(false);
		expect(modules.parserModule.loadMidiParser).not.toHaveBeenCalled();
		expect(modules.statusModule.statusState.messages).toHaveLength(1);
		expect(modules.statusModule.statusState.latestMessage?.text).toContain(
			'MIDI parser chunk could not be loaded'
		);
	});
});
