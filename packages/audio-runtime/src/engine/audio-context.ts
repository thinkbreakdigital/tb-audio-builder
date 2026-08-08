import { AudioInitializationError } from '../errors.js';
import { assertNever } from '../util/assert-never.js';

/**
 * Lifecycle of the single managed `AudioContext`. `'failed'` is reachable from `'uninitialized'`
 * (construction or first resume threw) and is retryable — the caller calls `initialize()` again
 * from a fresh user gesture.
 */
export type AudioContextStatus = 'uninitialized' | 'running' | 'suspended' | 'closed' | 'failed';

export interface AudioContextController {
	readonly status: AudioContextStatus;
	readonly context: BaseAudioContext | null;
	readonly currentTimeSeconds: number; // 0 when uninitialized
	initialize(): Promise<void>;
	suspend(): Promise<void>;
	resume(): Promise<void>;
	close(): Promise<void>;
	onStatusChange(listener: (status: AudioContextStatus) => void): () => void;
}

export function createAudioContextController(options?: {
	contextFactory?: () => BaseAudioContext; // injected in tests
	sampleRate?: number;
}): AudioContextController {
	const factory =
		options?.contextFactory ??
		(() =>
			new AudioContext(
				options?.sampleRate === undefined ? undefined : { sampleRate: options.sampleRate }
			));

	let status: AudioContextStatus = 'uninitialized';
	let context: BaseAudioContext | null = null;
	let pendingInitialize: Promise<void> | null = null;
	const listeners = new Set<(status: AudioContextStatus) => void>();

	function setStatus(next: AudioContextStatus): void {
		status = next;
		for (const listener of listeners) listener(status);
	}

	/**
	 * `AudioContextState` also has `'interrupted'` (Safari, when the OS steals the audio session),
	 * which has no first-class status here — it behaves like `'suspended'`: not running, but not a
	 * failure either.
	 */
	function mapContextState(state: AudioContextState): AudioContextStatus {
		switch (state) {
			case 'running':
				return 'running';
			case 'suspended':
			case 'interrupted':
				return 'suspended';
			case 'closed':
				return 'closed';
			default:
				return assertNever(state, 'AudioContextController.mapContextState');
		}
	}

	/**
	 * The public API commits to `BaseAudioContext` so tests can inject a fake implementing only
	 * the subset this engine uses. `resume`/`suspend`/`close` live on `AudioContext`, not the base
	 * interface, but `context` is always a real `AudioContext` or an equivalent fake — this narrows
	 * back at the single point of use (00-conventions.md §4 rule 1).
	 */
	function asManagedContext(base: BaseAudioContext): AudioContext {
		return base as AudioContext;
	}

	function handleStateChange(): void {
		if (context === null) return;
		setStatus(mapContextState(context.state));
	}

	async function doInitialize(): Promise<void> {
		try {
			// Reuse the context created by an earlier, failed attempt (e.g. resume() threw) rather
			// than calling the factory again — exactly one context is ever created per controller.
			const created = context ?? factory();
			if (context === null) {
				created.addEventListener('statechange', handleStateChange);
				context = created;
			}
			if (created.state === 'suspended') {
				await asManagedContext(created).resume();
			}
			setStatus(mapContextState(created.state));
		} catch (cause) {
			setStatus('failed');
			throw new AudioInitializationError(
				`AudioContextController.initialize() failed to create or resume the audio context ` +
					`(sampleRate=${options?.sampleRate ?? 'default'}).`,
				{ cause }
			);
		}
	}

	function initialize(): Promise<void> {
		// A suspended context is deliberately not a no-op: a later user gesture must be able to
		// recover audio after the browser or operating system interrupted it.
		if (status === 'running' || status === 'closed') {
			return Promise.resolve();
		}
		if (pendingInitialize !== null) return pendingInitialize;
		const attempt = doInitialize().finally(() => {
			pendingInitialize = null;
		});
		pendingInitialize = attempt;
		return attempt;
	}

	async function suspend(): Promise<void> {
		if (context === null) return;
		try {
			await asManagedContext(context).suspend();
			setStatus(mapContextState(context.state));
		} catch (cause) {
			setStatus('failed');
			throw new AudioInitializationError('AudioContextController.suspend() failed.', { cause });
		}
	}

	function resume(): Promise<void> {
		// Initialization already owns the one in-flight create/resume promise. Reusing it here keeps
		// concurrent gesture handlers from issuing duplicate resume() calls or racing graph creation.
		return initialize();
	}

	async function close(): Promise<void> {
		if (context !== null) {
			context.removeEventListener('statechange', handleStateChange);
			await asManagedContext(context).close();
		}
		setStatus('closed');
		listeners.clear();
	}

	function onStatusChange(listener: (status: AudioContextStatus) => void): () => void {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	return {
		get status() {
			return status;
		},
		get context() {
			return context;
		},
		get currentTimeSeconds() {
			return context === null ? 0 : context.currentTime;
		},
		initialize,
		suspend,
		resume,
		close,
		onStatusChange
	};
}
