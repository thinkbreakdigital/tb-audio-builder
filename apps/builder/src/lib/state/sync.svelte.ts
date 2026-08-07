/**
 * Server sync state. Declaration only in phase 04 — populated by the sync client in phase 12.
 * No network imports here.
 */

export type SyncStatus = 'idle' | 'saving' | 'synced' | 'offline' | 'conflict' | 'error';

function assertNever(value: never): never {
	throw new Error(`Unhandled sync status: ${String(value)}`);
}

function describeSyncStatus(current: SyncStatus): string {
	switch (current) {
		case 'idle':
			return 'Local only';
		case 'saving':
			return 'Saving…';
		case 'synced':
			return 'Saved to server';
		case 'offline':
			return 'Offline';
		case 'conflict':
			return 'Sync conflict';
		case 'error':
			return 'Sync error';
		default:
			return assertNever(current);
	}
}

let status = $state<SyncStatus>('idle');
let lastSyncedAtMs = $state<number | null>(null);

const label = $derived(describeSyncStatus(status));

export const syncState = {
	get status(): SyncStatus {
		return status;
	},
	get lastSyncedAtMs(): number | null {
		return lastSyncedAtMs;
	},
	get label(): string {
		return label;
	},

	setStatus(next: SyncStatus): void {
		status = next;
	},

	setLastSyncedAtMs(atMs: number | null): void {
		lastSyncedAtMs = atMs;
	}
};
