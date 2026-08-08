import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@thinkbreak/midi-parser', () => ({
	compileMidiFile: vi.fn()
}));

beforeEach(() => {
	vi.resetModules();
});

describe('loadMidiParser', () => {
	it('shares concurrent loads and retains the successful module promise', async () => {
		const { loadMidiParser } = await import('./load-parser.js');
		const first = loadMidiParser();
		const second = loadMidiParser();

		expect(second).toBe(first);
		await expect(first).resolves.toHaveProperty('compileMidiFile');
		expect(loadMidiParser()).toBe(first);
	});

	it('shares a failed attempt, then clears it so a later user action can retry', async () => {
		const { createMidiParserLoader } = await import('./load-parser.js');
		const parserModule = { compileMidiFile: vi.fn() } as never;
		const importer = vi
			.fn()
			.mockRejectedValueOnce(new Error('transient chunk failure'))
			.mockResolvedValue(parserModule);
		const load = createMidiParserLoader(importer as never);

		const first = load();
		expect(load()).toBe(first);
		await expect(first).rejects.toThrow(/transient chunk failure/);

		const retry = load();
		expect(retry).not.toBe(first);
		await expect(retry).resolves.toBe(parserModule);
		expect(load()).toBe(retry);
		expect(importer).toHaveBeenCalledTimes(2);
	});
});
