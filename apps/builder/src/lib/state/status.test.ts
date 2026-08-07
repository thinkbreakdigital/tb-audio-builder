import { beforeEach, describe, expect, it, vi } from 'vitest';

// status.svelte.ts is a module singleton (it also owns a lazily-started interval). Reset the
// module registry and re-import per test, and call clear() at the end of each test so no interval
// keeps running into the next test.
async function loadStatusState() {
	const module = await import('./status.svelte.js');
	return module;
}

beforeEach(() => {
	vi.resetModules();
});

describe('statusState.push', () => {
	it('keeps only the newest 50 of 60 pushed messages', async () => {
		const { statusState } = await loadStatusState();

		for (let index = 0; index < 60; index += 1) {
			statusState.push('warning', `message ${index}`);
		}

		expect(statusState.messages).toHaveLength(50);
		expect(statusState.messages[0]!.text).toBe('message 10');
		expect(statusState.messages.at(-1)!.text).toBe('message 59');
		statusState.clear();
	});

	it('latestMessage is the newest message', async () => {
		const { statusState } = await loadStatusState();

		statusState.push('info', 'first');
		statusState.push('warning', 'second');

		expect(statusState.latestMessage?.text).toBe('second');
		statusState.clear();
	});
});

describe('statusState.dismiss', () => {
	it('removes a message by id', async () => {
		const { statusState } = await loadStatusState();

		statusState.push('info', 'keep me');
		statusState.push('warning', 'dismiss me');
		const target = statusState.messages.find((message) => message.text === 'dismiss me')!;

		statusState.dismiss(target.id);

		expect(statusState.messages.some((message) => message.id === target.id)).toBe(false);
		expect(statusState.messages).toHaveLength(1);
		statusState.clear();
	});
});

describe('info-expiry sweep', () => {
	it('expires info messages but leaves warning/error messages', async () => {
		const { statusState, sweepExpiredStatusMessages } = await loadStatusState();

		statusState.push('info', 'transient');
		statusState.push('error', 'persistent');
		const farFutureMs = Date.now() + 60_000;

		sweepExpiredStatusMessages(farFutureMs);

		const remainingTexts = statusState.messages.map((message) => message.text);
		expect(remainingTexts).not.toContain('transient');
		expect(remainingTexts).toContain('persistent');
		statusState.clear();
	});
});
