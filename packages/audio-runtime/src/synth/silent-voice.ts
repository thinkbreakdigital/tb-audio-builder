/**
 * Test double for the voice interface. Creates no audio nodes, so it lets the scheduler and
 * transport be exercised end to end before phases 07/08 supply real synthesis. Phase 06 registers
 * it in the engine's factory registry; later phases replace it there and keep it around for tests.
 */

import type { Voice, VoiceFactory, VoicePriority, VoiceStartRequest } from './voice.js';

/**
 * A silent voice honors the full `Voice` lifecycle but never ends on its own timer — real voices
 * schedule their tail against `AudioContext.currentTime`, which does not advance in tests. Calling
 * `endNow()` is the explicit substitute: it fires the `onEnded` listeners synchronously so tests
 * control exactly when a voice is reclaimed.
 */
export interface SilentVoice extends Voice {
	endNow(): void;
	readonly releasedAtSeconds: number | null;
	readonly stoppedAtSeconds: number | null;
	readonly request: VoiceStartRequest;
}

class SilentVoiceImpl implements SilentVoice {
	readonly channelId: string;
	readonly midiNote: number;
	readonly startedAtSeconds: number;
	readonly priority: VoicePriority;
	readonly request: VoiceStartRequest;

	releasedAtSeconds: number | null = null;
	stoppedAtSeconds: number | null = null;

	private releasing = false;
	private ended = false;
	private readonly endedListeners: Array<() => void> = [];

	constructor(request: VoiceStartRequest) {
		this.channelId = request.channelId;
		this.midiNote = request.midiNote;
		this.startedAtSeconds = request.startAtSeconds;
		// `priority` is a deliberate extension on `VoiceStartRequest` (`voice.ts`); default 'normal'
		// covers a factory driven directly, without going through `VoiceManager.start`.
		this.priority = request.priority ?? 'normal';
		this.request = request;
	}

	get isReleasing(): boolean {
		return this.releasing;
	}

	release(atSeconds: number): void {
		this.releasing = true;
		this.releasedAtSeconds = atSeconds;
	}

	stop(atSeconds: number): void {
		this.stoppedAtSeconds = atSeconds;
		this.end();
	}

	onEnded(listener: () => void): void {
		this.endedListeners.push(listener);
	}

	dispose(): void {
		this.endedListeners.length = 0;
	}

	endNow(): void {
		this.end();
	}

	private end(): void {
		if (this.ended) return;
		this.ended = true;
		for (const listener of this.endedListeners) listener();
	}
}

/**
 * Deliberate extension beyond spec §4.6's `VoiceFactory` return type. The scheduler and transport
 * tests (next wave) need to assert exactly which notes were dispatched, with what request, and
 * when — so this returns the registrable factory alongside a live view of every voice it created,
 * rather than the bare `VoiceFactory`. Register `.factory`; observe with `.createdVoices`.
 */
export function createSilentVoiceFactory(kind: 'pitched' | 'percussion'): {
	factory: VoiceFactory;
	createdVoices: readonly SilentVoice[];
} {
	const createdVoices: SilentVoice[] = [];
	const factory: VoiceFactory = {
		kind,
		create(request: VoiceStartRequest): Voice {
			const voice = new SilentVoiceImpl(request);
			createdVoices.push(voice);
			return voice;
		}
	};
	return { factory, createdVoices };
}
