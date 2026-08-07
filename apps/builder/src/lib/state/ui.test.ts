import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadUiState() {
	const module = await import('./ui.svelte.js');
	return module;
}

beforeEach(() => {
	vi.resetModules();
});

describe('uiState defaults', () => {
	it('are selectedChannelId=null, mainView=instrument, openDialog=null', async () => {
		const { uiState } = await loadUiState();

		expect(uiState.selectedChannelId).toBeNull();
		expect(uiState.mainView).toBe('instrument');
		expect(uiState.openDialog).toBeNull();
	});
});

describe('uiState setters', () => {
	it('replace each field and accept null for the optional ones', async () => {
		const { uiState } = await loadUiState();

		uiState.setSelectedChannelId('channel-1');
		uiState.setMainView('mixer');
		uiState.setOpenDialog('confirm-delete');
		expect(uiState.selectedChannelId).toBe('channel-1');
		expect(uiState.mainView).toBe('mixer');
		expect(uiState.openDialog).toBe('confirm-delete');

		uiState.setSelectedChannelId(null);
		uiState.setOpenDialog(null);
		expect(uiState.selectedChannelId).toBeNull();
		expect(uiState.openDialog).toBeNull();
	});
});

describe('uiState module init', () => {
	it('does not touch localStorage', async () => {
		Reflect.deleteProperty(globalThis, 'localStorage');

		await expect(loadUiState()).resolves.toBeDefined();
	});
});
