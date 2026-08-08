import {
	ANALYSER_FFT_SIZE,
	ANALYSER_SMOOTHING_TIME_CONSTANT,
	PARAMETER_RAMP_TIME_CONSTANT_SECONDS
} from '../constants.js';
import { PlaybackError } from '../errors.js';
import type { ChannelMixSettings } from '../types/channel.js';

/**
 * Fixed graph: `voice output -> channelGain -> channelPanner -> channelAnalyser -> destination`.
 * Mute never disconnects — `setAudible` only ramps `channelGain` to zero — so the graph is built
 * once here and never rebuilt (spec §4.5 rule 2).
 */
export interface ChannelBus {
	readonly channelId: string;
	readonly input: AudioNode; // voices connect here
	setGain(value: number, atSeconds: number): void;
	setPan(value: number, atSeconds: number): void;
	setAudible(audible: boolean, atSeconds: number): void;
	readPeakLevel(): number; // 0..1, from the analyser; safe to call at any rate
	dispose(): void;
}

export function createChannelBus(input: {
	context: BaseAudioContext;
	channelId: string;
	destination: AudioNode;
	mix: ChannelMixSettings;
}): ChannelBus {
	const { context, channelId, destination, mix } = input;

	const channelGain = context.createGain();
	const channelPanner = context.createStereoPanner();
	const channelAnalyser = context.createAnalyser();
	channelAnalyser.fftSize = ANALYSER_FFT_SIZE;
	channelAnalyser.smoothingTimeConstant = ANALYSER_SMOOTHING_TIME_CONSTANT;

	channelGain.connect(channelPanner);
	channelPanner.connect(channelAnalyser);
	channelAnalyser.connect(destination);

	// The caller (engine) owns the full `enabled && !muted && (noChannelIsSoloed || soloed)` rule
	// and is expected to call setAudible() once solo state is known; `!mix.muted` is only the
	// construction-time default so a freshly built bus is never audibly wrong before that call.
	const constructedAtSeconds = context.currentTime;
	let requestedGain = mix.gain;
	let audible = !mix.muted;
	channelGain.gain.setTargetAtTime(
		audible ? requestedGain : 0,
		constructedAtSeconds,
		PARAMETER_RAMP_TIME_CONSTANT_SECONDS
	);
	channelPanner.pan.setTargetAtTime(
		mix.pan,
		constructedAtSeconds,
		PARAMETER_RAMP_TIME_CONSTANT_SECONDS
	);

	// Allocated once and reused on every readPeakLevel() call (spec §4.5 rule 3).
	const peakBuffer = new Float32Array(channelAnalyser.fftSize);
	let disposed = false;

	function ensureNotDisposed(action: string): void {
		if (disposed) {
			throw new PlaybackError(`ChannelBus "${channelId}": cannot ${action} after dispose().`);
		}
	}

	return {
		channelId,
		input: channelGain,

		setGain(value, atSeconds) {
			ensureNotDisposed('setGain');
			requestedGain = value;
			// While inaudible, store the requested gain without ramping the node — that would
			// un-mute the channel as a side effect of a plain volume change.
			if (audible) {
				channelGain.gain.setTargetAtTime(value, atSeconds, PARAMETER_RAMP_TIME_CONSTANT_SECONDS);
			}
		},

		setPan(value, atSeconds) {
			ensureNotDisposed('setPan');
			channelPanner.pan.setTargetAtTime(value, atSeconds, PARAMETER_RAMP_TIME_CONSTANT_SECONDS);
		},

		setAudible(nextAudible, atSeconds) {
			ensureNotDisposed('setAudible');
			audible = nextAudible;
			channelGain.gain.setTargetAtTime(
				audible ? requestedGain : 0,
				atSeconds,
				PARAMETER_RAMP_TIME_CONSTANT_SECONDS
			);
		},

		readPeakLevel() {
			ensureNotDisposed('readPeakLevel');
			channelAnalyser.getFloatTimeDomainData(peakBuffer);
			let peak = 0;
			for (let i = 0; i < peakBuffer.length; i += 1) {
				const sample = Math.abs(peakBuffer[i] ?? 0);
				if (sample > peak) peak = sample;
			}
			return peak;
		},

		dispose() {
			ensureNotDisposed('dispose');
			disposed = true;
			channelGain.disconnect();
			channelPanner.disconnect();
			channelAnalyser.disconnect();
		}
	};
}
