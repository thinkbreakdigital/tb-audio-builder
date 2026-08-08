/**
 * White noise for the percussion noise layer (spec §4.1).
 *
 * The samples are generated once per audio context and shared by every hit, because filling a
 * five-second buffer is the expensive part of a noise layer and nothing about it varies per note
 * (kickoff §37). `AudioBufferSourceNode` is single-use by specification, so each hit still builds
 * its own source node and points it at this buffer; the source is never cached.
 */

/** Covers the maximum legal 0.5s attack + 2s decay + 2s release, plus the stop margin. */
export const NOISE_BUFFER_SECONDS = 5;

const NOISE_BUFFER_CHANNEL_COUNT = 1;

/**
 * Module-level by necessity, and the one exception this package makes to "no hidden global mutable
 * state" (`00-conventions.md` §4 rule 8) — hence `clearNoiseBufferCache`, its explicit dispose.
 * Keying on the context means the cache can never outlive the context it belongs to.
 */
const buffersByContext = new WeakMap<BaseAudioContext, AudioBuffer>();

export function getWhiteNoiseBuffer(
	context: BaseAudioContext,
	/** Injectable so a test can assert exact samples; production always uses `Math.random`. */
	random: () => number = Math.random
): AudioBuffer {
	const cached = buffersByContext.get(context);
	if (cached !== undefined) return cached;

	const frameCount = Math.round(NOISE_BUFFER_SECONDS * context.sampleRate);
	const buffer = context.createBuffer(NOISE_BUFFER_CHANNEL_COUNT, frameCount, context.sampleRate);
	const samples = buffer.getChannelData(0);
	for (let index = 0; index < frameCount; index += 1) {
		samples[index] = random() * 2 - 1;
	}

	buffersByContext.set(context, buffer);
	return buffer;
}

export function clearNoiseBufferCache(context: BaseAudioContext): void {
	buffersByContext.delete(context);
}
