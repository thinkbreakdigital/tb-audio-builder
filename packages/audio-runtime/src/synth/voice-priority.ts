/**
 * Voice priority is *derived*, not stored.
 *
 * The kickoff requires a `maxDroneVoices` limit and a "low priority" tier for voice stealing, but
 * `InstrumentDefinition` carries no priority field and adding one would put a scheduling concern
 * into a user-facing sound description. So priority is read off the sound's character instead: a
 * slow-attack, high-sustain pitched instrument is a pad or drone, which is both the thing the
 * `maxDroneVoices` cap exists for and the least noticeable thing to steal when the engine runs out
 * of voices. Percussion is always `normal` — a stolen drum hit is immediately audible as a hole in
 * the rhythm.
 *
 * This is the single definition of that derivation (spec §4.2).
 */

import type { InstrumentDefinition } from '../types/instrument.js';
import { assertNever } from '../util/assert-never.js';
import type { VoicePriority } from './voice.js';

/** At or above both thresholds, a pitched instrument is treated as a pad/drone. */
export const DRONE_ATTACK_SECONDS = 0.25;
export const DRONE_SUSTAIN_LEVEL = 0.5;

export function resolveVoicePriority(instrument: InstrumentDefinition): VoicePriority {
	switch (instrument.kind) {
		case 'pitched':
			return instrument.amplitudeEnvelope.attackSeconds >= DRONE_ATTACK_SECONDS &&
				instrument.amplitudeEnvelope.sustainLevel >= DRONE_SUSTAIN_LEVEL
				? 'low'
				: 'normal';
		case 'percussion':
			return 'normal';
		default:
			return assertNever(instrument, 'resolveVoicePriority');
	}
}

export function resolveMaxVoicesForChannel(
	instrument: InstrumentDefinition,
	limits: { maxVoicesPerChannel: number; maxDroneVoices: number }
): number {
	switch (instrument.kind) {
		case 'pitched': {
			if (!instrument.voice.polyphonic) return 1;
			const ceiling =
				resolveVoicePriority(instrument) === 'low'
					? limits.maxDroneVoices
					: limits.maxVoicesPerChannel;
			return Math.min(ceiling, instrument.voice.maxVoices);
		}
		case 'percussion':
			// Percussion declares no per-instrument voice count; the global channel limit applies.
			return limits.maxVoicesPerChannel;
		default:
			return assertNever(instrument, 'resolveMaxVoicesForChannel');
	}
}
