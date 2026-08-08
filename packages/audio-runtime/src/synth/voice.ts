/**
 * The interface between the scheduler/voice manager and synthesis. Contains no synthesis itself —
 * phases 07 and 08 register the real pitched and percussion factories; `silent-voice.ts` registers
 * a test double so this phase's transport is testable end to end.
 */

import type { InstrumentDefinition } from '../types/instrument.js';

export type VoicePriority = 'normal' | 'low';

export interface Voice {
	readonly channelId: string;
	readonly midiNote: number;
	readonly startedAtSeconds: number;
	readonly priority: VoicePriority;
	readonly isReleasing: boolean;
	/** Schedule the release phase to begin at this audio-context time. */
	release(atSeconds: number): void;
	/** Hard-stop and disconnect immediately, ignoring the release envelope. */
	stop(atSeconds: number): void;
	/** Called by the voice when its tail has finished; the manager reclaims it. */
	onEnded(listener: () => void): void;
	dispose(): void;
}

export interface VoiceStartRequest {
	channelId: string;
	instrument: InstrumentDefinition;
	midiNote: number;
	velocity: number;
	startAtSeconds: number;
	/** Release time; the voice schedules its own release. Infinity means "until released". */
	releaseAtSeconds: number;
	destination: AudioNode;
	context: BaseAudioContext;
	/**
	 * Deliberate extension beyond spec §4.6. Timeline event `sequence` that produced this note. The
	 * manager breaks voice-stealing ties with it so allocation is deterministic regardless of
	 * dispatch order (§4.7 rule 2). Absent for previews, which fall back to the manager's own
	 * monotonic allocation counter.
	 */
	sequence?: number;
	/**
	 * Deliberate extension beyond spec §4.6. `VoiceStartRequest` otherwise carries no priority, but
	 * `Voice.priority` must report truthfully, so the voice manager forwards the priority it was
	 * given into the request it hands the factory (`VoiceManager.start` keeps its spec signature).
	 * Defaults to 'normal' when a factory is driven directly, e.g. in a unit test.
	 */
	priority?: VoicePriority;
}

export interface VoiceFactory {
	readonly kind: 'pitched' | 'percussion';
	create(request: VoiceStartRequest): Voice;
}

export function createVoiceFactoryRegistry(): {
	register(factory: VoiceFactory): void;
	get(kind: 'pitched' | 'percussion'): VoiceFactory;
} {
	const factories = new Map<'pitched' | 'percussion', VoiceFactory>();

	return {
		register(factory: VoiceFactory): void {
			factories.set(factory.kind, factory);
		},
		get(kind: 'pitched' | 'percussion'): VoiceFactory {
			const factory = factories.get(kind);
			if (factory === undefined) {
				throw new Error(`No voice factory registered for instrument kind "${kind}".`);
			}
			return factory;
		}
	};
}
