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
	/**
	 * Deliberate extension beyond spec §4.1's signature. The release starts from the level the
	 * envelope holds at `releaseAtSeconds`. Reading `param.value` is only correct when the release is
	 * scheduled while the note is already sounding; a voice that schedules its whole envelope up
	 * front knows that level analytically (`peakValue * sustainLevel`) and passes it here, because at
	 * construction time a real `AudioParam` still reports its pre-attack value.
	 */
	fromValue?: number;
}): number {
	const { param, releaseAtSeconds, settings } = input;

	const startValue = input.fromValue ?? param.value;
	param.cancelScheduledValues(releaseAtSeconds);
	param.setValueAtTime(startValue, releaseAtSeconds);

	const releaseEndSeconds =
		releaseAtSeconds + Math.max(settings.releaseSeconds, MIN_ENVELOPE_RAMP_SECONDS);
	param.linearRampToValueAtTime(0, releaseEndSeconds);
	return releaseEndSeconds;
}
