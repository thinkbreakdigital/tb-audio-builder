/**
 * User-visible status messages (import results, sync state, errors). Kickoff §37 forbids
 * unbounded logs, so the list is capped and `info` messages self-expire.
 */

export type StatusLevel = 'info' | 'warning' | 'error';

export interface StatusMessage {
	id: string;
	level: StatusLevel;
	text: string;
	atMs: number;
	detail?: string;
}

const MAX_MESSAGES = 50;
const INFO_EXPIRY_MS = 8000;
const SWEEP_INTERVAL_MS = 1000;

let messages = $state<StatusMessage[]>([]);
let sweepIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Removes `info` messages older than `INFO_EXPIRY_MS`. Exported (in addition to being wired to
 * the module-owned interval) so tests can trigger a sweep deterministically instead of waiting on
 * real timers.
 */
export function sweepExpiredStatusMessages(nowMs: number = Date.now()): void {
	if (messages.length === 0) return;
	messages = messages.filter(
		(message) => message.level !== 'info' || nowMs - message.atMs < INFO_EXPIRY_MS
	);
	if (messages.length === 0) stopSweep();
}

function startSweep(): void {
	if (sweepIntervalId !== null) return;
	const id = setInterval(() => sweepExpiredStatusMessages(), SWEEP_INTERVAL_MS);
	// Node's Timeout exposes unref() so a pending sweep never keeps a process (or a test runner)
	// alive; the browser's numeric timer handle has no such method.
	if (typeof id === 'object' && typeof id.unref === 'function') id.unref();
	sweepIntervalId = id;
}

function stopSweep(): void {
	if (sweepIntervalId === null) return;
	clearInterval(sweepIntervalId);
	sweepIntervalId = null;
}

const latestMessage = $derived(messages.at(-1) ?? null);

export const statusState = {
	get messages(): readonly StatusMessage[] {
		return messages;
	},
	get latestMessage(): StatusMessage | null {
		return latestMessage;
	},

	push(level: StatusLevel, text: string, detail?: string): void {
		const message: StatusMessage = {
			id: crypto.randomUUID(),
			level,
			text,
			atMs: Date.now(),
			detail
		};
		const next = [...messages, message];
		messages = next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
		startSweep();
	},

	dismiss(id: string): void {
		messages = messages.filter((message) => message.id !== id);
		if (messages.length === 0) stopSweep();
	},

	clear(): void {
		messages = [];
		stopSweep();
	}
};
