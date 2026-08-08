import {
	ANALYSER_FFT_SIZE,
	ANALYSER_SMOOTHING_TIME_CONSTANT,
	PARAMETER_RAMP_TIME_CONSTANT_SECONDS
} from '../constants.js';
import { PlaybackError } from '../errors.js';
import type { CompressorSettings } from '../types/project.js';

/**
 * Fixed graph: `masterGain -> masterCompressor (optional bypass) -> masterAnalyser -> destination`.
 * `context.destination` is the real audio device output; there is nothing downstream of this bus.
 */
export interface MasterBus {
	readonly input: AudioNode;
	setGain(value: number, atSeconds: number): void;
	setCompressor(settings: CompressorSettings, atSeconds: number): void;
	readPeakLevel(): number;
	dispose(): void;
}

export function createMasterBus(input: {
	context: BaseAudioContext;
	settings: { gain: number; compressor: CompressorSettings };
}): MasterBus {
	const { context, settings } = input;

	const masterGain = context.createGain();
	const masterCompressor = context.createDynamicsCompressor();
	const masterAnalyser = context.createAnalyser();
	masterAnalyser.fftSize = ANALYSER_FFT_SIZE;
	masterAnalyser.smoothingTimeConstant = ANALYSER_SMOOTHING_TIME_CONSTANT;

	masterGain.connect(masterCompressor);
	masterCompressor.connect(masterAnalyser);
	masterAnalyser.connect(context.destination);

	const constructedAtSeconds = context.currentTime;
	masterGain.gain.setTargetAtTime(
		settings.gain,
		constructedAtSeconds,
		PARAMETER_RAMP_TIME_CONSTANT_SECONDS
	);
	applyCompressorSettings(masterCompressor, settings.compressor, constructedAtSeconds);

	// Allocated once and reused on every readPeakLevel() call (spec §4.5 rule 3).
	const peakBuffer = new Float32Array(masterAnalyser.fftSize);
	let disposed = false;

	function ensureNotDisposed(action: string): void {
		if (disposed) {
			throw new PlaybackError(`MasterBus: cannot ${action} after dispose().`);
		}
	}

	return {
		input: masterGain,

		setGain(value, atSeconds) {
			ensureNotDisposed('setGain');
			masterGain.gain.setTargetAtTime(value, atSeconds, PARAMETER_RAMP_TIME_CONSTANT_SECONDS);
		},

		setCompressor(compressorSettings, atSeconds) {
			ensureNotDisposed('setCompressor');
			applyCompressorSettings(masterCompressor, compressorSettings, atSeconds);
		},

		readPeakLevel() {
			ensureNotDisposed('readPeakLevel');
			masterAnalyser.getFloatTimeDomainData(peakBuffer);
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
			masterGain.disconnect();
			masterCompressor.disconnect();
			masterAnalyser.disconnect();
		}
	};
}

/**
 * `enabled === false` bypasses the compressor via parameter values — threshold 0, ratio 1, knee 0
 * — never by rewiring; the node is created once in createMasterBus and never replaced (spec §4.5
 * rule 4). Attack/release are left as last set when disabled since they have no audible effect on
 * a bypassed compressor.
 */
function applyCompressorSettings(
	node: DynamicsCompressorNode,
	settings: CompressorSettings,
	atSeconds: number
): void {
	if (!settings.enabled) {
		node.threshold.setTargetAtTime(0, atSeconds, PARAMETER_RAMP_TIME_CONSTANT_SECONDS);
		node.ratio.setTargetAtTime(1, atSeconds, PARAMETER_RAMP_TIME_CONSTANT_SECONDS);
		node.knee.setTargetAtTime(0, atSeconds, PARAMETER_RAMP_TIME_CONSTANT_SECONDS);
		return;
	}
	node.threshold.setTargetAtTime(
		settings.thresholdDb,
		atSeconds,
		PARAMETER_RAMP_TIME_CONSTANT_SECONDS
	);
	node.knee.setTargetAtTime(settings.kneeDb, atSeconds, PARAMETER_RAMP_TIME_CONSTANT_SECONDS);
	node.ratio.setTargetAtTime(settings.ratio, atSeconds, PARAMETER_RAMP_TIME_CONSTANT_SECONDS);
	node.attack.setTargetAtTime(
		settings.attackSeconds,
		atSeconds,
		PARAMETER_RAMP_TIME_CONSTANT_SECONDS
	);
	node.release.setTargetAtTime(
		settings.releaseSeconds,
		atSeconds,
		PARAMETER_RAMP_TIME_CONSTANT_SECONDS
	);
}
