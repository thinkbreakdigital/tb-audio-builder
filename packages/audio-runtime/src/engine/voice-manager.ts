/**
 * Deterministic voice allocation and stealing (kickoff §16). The scheduler and `triggerPreview`
 * are the only callers of `start`; this module owns every policy decision about which voice yields
 * when limits are hit, so that policy lives in exactly one place.
 */

import { DEFAULT_AUDIO_LIMITS } from '../constants.js';
import { resolveChokeGroup } from '../synth/percussion-voice.js';
import type { InstrumentDefinition } from '../types/instrument.js';
import { assertNever } from '../util/assert-never.js';
import type {
	Voice,
	VoicePriority,
	VoiceStartRequest,
	createVoiceFactoryRegistry
} from '../synth/voice.js';

export interface VoiceManagerLimits {
	maxTotalVoices: number;
	maxVoicesPerChannel: number;
}

export interface VoiceManager {
	/** Every owned voice that may still sound, including release and bounded-steal tails. */
	readonly activeVoiceCount: number;
	/**
	 * Deliberate extension beyond spec §4.7's literal `VoiceManager` interface: the spec's rule 4
	 * asks for "a counter exposed for diagnostics" when a note is dropped; this is that counter.
	 */
	readonly droppedVoiceCount: number;
	start(request: VoiceStartRequest, priority: VoicePriority): Voice | null;
	releaseChannel(channelId: string, atSeconds: number): void;
	releaseAll(atSeconds: number): void;
	stopAll(atSeconds: number): void;
	stopChokeGroup(chokeGroup: string, atSeconds: number): void;
	setLimits(limits: VoiceManagerLimits): void;
	dispose(): void;
}

interface VoiceRecord {
	readonly voice: Voice;
	readonly channelId: string;
	readonly priority: VoicePriority;
	readonly startedAtSeconds: number;
	readonly sequence: number;
	readonly chokeGroup: string | null;
	readonly midiNote: number;
	readonly velocity: number;
	boundedTail: boolean;
}

/** Oldest by `startedAtSeconds`, ties broken by `sequence` — the deterministic ordering rule. */
function oldestOf(records: readonly VoiceRecord[]): VoiceRecord | undefined {
	let best: VoiceRecord | undefined;
	for (const record of records) {
		if (
			best === undefined ||
			record.startedAtSeconds < best.startedAtSeconds ||
			(record.startedAtSeconds === best.startedAtSeconds && record.sequence < best.sequence)
		) {
			best = record;
		}
	}
	return best;
}

function deterministicEarlier(a: VoiceRecord, b: VoiceRecord): boolean {
	return (
		a.startedAtSeconds < b.startedAtSeconds ||
		(a.startedAtSeconds === b.startedAtSeconds && a.sequence < b.sequence)
	);
}

function channelVictim(
	records: readonly VoiceRecord[],
	instrument: InstrumentDefinition
): VoiceRecord | undefined {
	if (instrument.kind !== 'pitched' || instrument.voice.stealMode === 'oldest') {
		return oldestOf(records);
	}

	let best: VoiceRecord | undefined;
	for (const record of records) {
		if (best === undefined) {
			best = record;
			continue;
		}
		const value = instrument.voice.stealMode === 'quietest' ? record.velocity : record.midiNote;
		const bestValue = instrument.voice.stealMode === 'quietest' ? best.velocity : best.midiNote;
		if (value < bestValue || (value === bestValue && deterministicEarlier(record, best)))
			best = record;
	}
	return best;
}

export function createVoiceManager(input: {
	registry: ReturnType<typeof createVoiceFactoryRegistry>;
	limits: VoiceManagerLimits;
	maxVoicesPerChannelOverride?: (channelId: string) => number | undefined;
}): VoiceManager {
	const { registry, maxVoicesPerChannelOverride } = input;
	let limits = input.limits;

	// Two tiers (§4.7 rule 1). `activeRecords` counts toward new-voice allocation limits.
	// `releasingRecords` holds voices that have been released — by a steal, `releaseChannel`, or
	// `releaseAll` — but have not yet reported `onEnded`: they no longer occupy an allocation slot,
	// but the manager still owns them, so a hard stop (`stopAll`, `stopChokeGroup`, `dispose`) still
	// reaches their tail. Both tiers count as live for diagnostics; a voice belongs to at most one
	// tier at a time.
	const activeRecords = new Set<VoiceRecord>();
	const releasingRecords = new Set<VoiceRecord>();
	let droppedVoiceCount = 0;
	// Fallback sequence for requests with no timeline `sequence` (previews). Kept in its own,
	// always-increasing namespace so it never collides with a real timeline sequence.
	let nextFallbackSequence = 0;

	function recordsForChannel(channelId: string): VoiceRecord[] {
		return [...activeRecords].filter((record) => record.channelId === channelId);
	}

	function removeRecord(record: VoiceRecord): void {
		activeRecords.delete(record);
		releasingRecords.delete(record);
	}

	function effectiveChannelLimit(channelId: string, instrument: InstrumentDefinition): number {
		const override = maxVoicesPerChannelOverride?.(channelId);
		if (override !== undefined) return override;

		switch (instrument.kind) {
			case 'pitched':
				return instrument.voice.polyphonic === false
					? 1
					: Math.min(instrument.voice.maxVoices, DEFAULT_AUDIO_LIMITS.maxVoicesPerChannel);
			case 'percussion':
				return limits.maxVoicesPerChannel;
			default:
				return assertNever(instrument, 'voice-manager effective channel limit');
		}
	}

	/** A bounded steal uses the voice's short click-safe tail, never its user-editable release. */
	function steal(record: VoiceRecord, atSeconds: number): void {
		activeRecords.delete(record);
		releasingRecords.add(record);
		record.boundedTail = true;
		record.voice.steal(atSeconds);
	}

	function start(request: VoiceStartRequest, priority: VoicePriority): Voice | null {
		const factory = registry.get(request.instrument.kind);
		// Normalized through the same helper the engine chokes with, so the two can never disagree
		// about which group a voice belongs to (§4.4 rule 5).
		const chokeGroup = resolveChokeGroup(request.instrument);
		const channelLimit = effectiveChannelLimit(request.channelId, request.instrument);
		const sequence = request.sequence ?? nextFallbackSequence++;

		// A rapid pause/resume cycle must not stack full user-configured release tails. As soon as new
		// playback is scheduled, any tails left by releaseAll() are converted to the bounded steal tail.
		for (const record of releasingRecords) {
			if (!record.boundedTail) {
				record.boundedTail = true;
				record.voice.steal(request.startAtSeconds);
			}
		}

		// Rule 2: the channel is at its per-channel limit.
		if (recordsForChannel(request.channelId).length >= channelLimit) {
			const victim = channelVictim(recordsForChannel(request.channelId), request.instrument);
			if (victim !== undefined) steal(victim, request.startAtSeconds);
		}

		// Rule 3: the global limit is reached — prefer stealing a low-priority voice anywhere.
		if (activeRecords.size >= limits.maxTotalVoices) {
			const allRecords = [...activeRecords];
			const lowPriorityRecords = allRecords.filter((record) => record.priority === 'low');
			const victim = oldestOf(lowPriorityRecords.length > 0 ? lowPriorityRecords : allRecords);
			if (victim !== undefined) steal(victim, request.startAtSeconds);
		}

		// Rule 4: still over a limit (e.g. an override of 0, or maxTotalVoices of 0) — drop the note.
		if (
			recordsForChannel(request.channelId).length >= channelLimit ||
			activeRecords.size >= limits.maxTotalVoices
		) {
			droppedVoiceCount++;
			return null;
		}

		// `priority` is forwarded into the request (voice.ts's deliberate extension) so the voice
		// itself can report it truthfully; the manager's own bookkeeping never depends on that.
		const voice = factory.create({ ...request, priority });
		const record: VoiceRecord = {
			voice,
			channelId: request.channelId,
			priority,
			startedAtSeconds: request.startAtSeconds,
			sequence,
			chokeGroup,
			midiNote: request.midiNote,
			velocity: request.velocity,
			boundedTail: false
		};
		activeRecords.add(record);
		voice.onEnded(() => {
			removeRecord(record);
		});
		return voice;
	}

	function releaseChannel(channelId: string, atSeconds: number): void {
		for (const record of recordsForChannel(channelId)) {
			activeRecords.delete(record);
			releasingRecords.add(record);
			record.boundedTail = false;
			record.voice.release(atSeconds);
		}
	}

	function releaseAll(atSeconds: number): void {
		for (const record of activeRecords) {
			releasingRecords.add(record);
			record.boundedTail = false;
			record.voice.release(atSeconds);
		}
		activeRecords.clear();
	}

	function stopAll(atSeconds: number): void {
		// A hard stop reaches both tiers — no release tail survives a stop (§4.8).
		for (const record of activeRecords) record.voice.stop(atSeconds);
		for (const record of releasingRecords) record.voice.stop(atSeconds);
		activeRecords.clear();
		releasingRecords.clear();
	}

	function stopChokeGroup(chokeGroup: string, atSeconds: number): void {
		for (const record of [...activeRecords, ...releasingRecords]) {
			// Only what is already sounding. A voice that starts at or after `atSeconds` — the choking
			// hit itself, and anything scheduled later in the same look-ahead window — is left alone,
			// so a group never cuts its own trigger (§4.4 rule 3).
			if (record.chokeGroup === chokeGroup && record.startedAtSeconds < atSeconds) {
				removeRecord(record);
				record.voice.stop(atSeconds);
			}
		}
	}

	function setLimits(nextLimits: VoiceManagerLimits): void {
		limits = nextLimits;
	}

	function dispose(): void {
		// No context time is available here; 0 is fine because this is a hard stop and the caller
		// (the engine facade) closes the audio context immediately after.
		for (const record of [...activeRecords, ...releasingRecords]) {
			record.voice.stop(0);
			record.voice.dispose();
		}
		activeRecords.clear();
		releasingRecords.clear();
	}

	return {
		get activeVoiceCount(): number {
			return activeRecords.size + releasingRecords.size;
		},
		get droppedVoiceCount(): number {
			return droppedVoiceCount;
		},
		start,
		releaseChannel,
		releaseAll,
		stopAll,
		stopChokeGroup,
		setLimits,
		dispose
	};
}
