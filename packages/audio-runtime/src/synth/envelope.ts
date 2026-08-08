/**
 * The one ADSR implementation in the package. Pitched voices use it here; both percussion layers
 * use it in phase 08. No other module schedules envelope automation, so envelope shape is defined
 * exactly once (spec §4.1).
 *
 * Ramps are linear rather than `setTargetAtTime` so the tail has a deterministic, testable end
 * time — an exponential approach never actually reaches zero, and the voice needs to know when it
 * is safe to stop its oscillator.
 */

/** Every ramp is at least this long: a zero-length segment is a discontinuity, which clicks. */
export const MIN_ENVELOPE_RAMP_SECONDS = 0.001;

export interface AdsrSettings {
	attackSeconds: number;
	decaySeconds: number;
	sustainLevel: number;
	releaseSeconds: number;
}

/**
 * Analytic value of the attack/decay/sustain stage at an audio-context time. Voices schedule
 * automation ahead of the context clock, so reading `AudioParam.value` cannot answer this reliably.
 */
export function adsrLevelAtSeconds(input: {
	startAtSeconds: number;
	peakValue: number;
	settings: AdsrSettings;
	atSeconds: number;
}): number {
	const { startAtSeconds, peakValue, settings, atSeconds } = input;
	if (atSeconds <= startAtSeconds) return 0;

	const attackEndSeconds =
		startAtSeconds + Math.max(settings.attackSeconds, MIN_ENVELOPE_RAMP_SECONDS);
	if (atSeconds <= attackEndSeconds) {
		return peakValue * ((atSeconds - startAtSeconds) / (attackEndSeconds - startAtSeconds));
	}

	const decayEndSeconds =
		attackEndSeconds + Math.max(settings.decaySeconds, MIN_ENVELOPE_RAMP_SECONDS);
	const sustainValue = peakValue * settings.sustainLevel;
	if (atSeconds >= decayEndSeconds) return sustainValue;

	const decayProgress = (atSeconds - attackEndSeconds) / (decayEndSeconds - attackEndSeconds);
	return peakValue + (sustainValue - peakValue) * decayProgress;
}

export function applyAttackDecaySustain(input: {
	param: AudioParam;
	startAtSeconds: number;
	/** Velocity-scaled peak the attack ramps to. */
	peakValue: number;
	settings: AdsrSettings;
}): void {
	const { param, startAtSeconds, peakValue, settings } = input;

	param.cancelScheduledValues(startAtSeconds);
	param.setValueAtTime(0, startAtSeconds);

	const attackEndSeconds =
		startAtSeconds + Math.max(settings.attackSeconds, MIN_ENVELOPE_RAMP_SECONDS);
	param.linearRampToValueAtTime(peakValue, attackEndSeconds);

	// `sustainLevel: 0` is legal and yields a percussive shape; the decay simply lands on silence.
	const decayEndSeconds =
		attackEndSeconds + Math.max(settings.decaySeconds, MIN_ENVELOPE_RAMP_SECONDS);
	param.linearRampToValueAtTime(peakValue * settings.sustainLevel, decayEndSeconds);
}

/** The audio time at which the release tail has fully decayed to zero. */
export function applyRelease(input: {
	param: AudioParam;
	releaseAtSeconds: number;
	settings: AdsrSettings;
	/** Value the ADS stage holds at `releaseAtSeconds`, computed by `adsrLevelAtSeconds`. */
	fromValue: number;
}): number {
	const { param, releaseAtSeconds, settings } = input;

	param.cancelScheduledValues(releaseAtSeconds);
	param.setValueAtTime(input.fromValue, releaseAtSeconds);

	const releaseEndSeconds =
		releaseAtSeconds + Math.max(settings.releaseSeconds, MIN_ENVELOPE_RAMP_SECONDS);
	param.linearRampToValueAtTime(0, releaseEndSeconds);
	return releaseEndSeconds;
}
