import { describe, expect, it } from 'vitest';
import {
	clearNoiseBufferCache,
	getWhiteNoiseBuffer,
	NOISE_BUFFER_SECONDS
} from '../src/synth/noise-buffer.js';
import {
	asBaseAudioContext,
	asFakeAudioBuffer,
	createFakeAudioContext
} from './fakes/fake-audio-context.js';

/** A `random` whose output is fully determined by its call index. */
function countingRandom(): () => number {
	let index = 0;
	return () => {
		const value = index / 10;
		index += 1;
		return value % 1;
	};
}

describe('getWhiteNoiseBuffer', () => {
	it('generates one mono 2.0s buffer at the context sample rate', () => {
		const fake = createFakeAudioContext({ sampleRate: 48000 });

		const buffer = asFakeAudioBuffer(getWhiteNoiseBuffer(asBaseAudioContext(fake)));

		expect(NOISE_BUFFER_SECONDS).toBe(2);
		expect(buffer.numberOfChannels).toBe(1);
		expect(buffer.sampleRate).toBe(48000);
		expect(buffer.length).toBe(96000);
		expect(buffer.duration).toBe(2);
	});

	it('returns the same AudioBuffer instance for repeated calls on one context', () => {
		const fake = createFakeAudioContext();
		const context = asBaseAudioContext(fake);

		const first = getWhiteNoiseBuffer(context);
		const second = getWhiteNoiseBuffer(context);

		expect(second).toBe(first);
	});

	it('gives different contexts their own buffers', () => {
		const first = getWhiteNoiseBuffer(asBaseAudioContext(createFakeAudioContext()));
		const second = getWhiteNoiseBuffer(asBaseAudioContext(createFakeAudioContext()));

		expect(second).not.toBe(first);
	});

	it('fills every sample within [-1, 1]', () => {
		const fake = createFakeAudioContext({ sampleRate: 8000 });

		const samples = asFakeAudioBuffer(getWhiteNoiseBuffer(asBaseAudioContext(fake))).getChannelData(
			0
		);

		expect(samples).toHaveLength(16000);
		let outOfRangeCount = 0;
		let zeroCount = 0;
		for (const sample of samples) {
			if (sample < -1 || sample > 1) outOfRangeCount += 1;
			if (sample === 0) zeroCount += 1;
		}
		expect(outOfRangeCount).toBe(0);
		// Guards against a buffer that was allocated but never written.
		expect(zeroCount).toBeLessThan(samples.length);
	});

	it('maps an injected random onto the documented [-1, 1] range', () => {
		const fake = createFakeAudioContext({ sampleRate: 8000 });

		const samples = asFakeAudioBuffer(
			getWhiteNoiseBuffer(asBaseAudioContext(fake), countingRandom())
		).getChannelData(0);

		// random() * 2 - 1, for 0, 0.1, 0.2, ...
		expect([...samples.slice(0, 5)].map((value) => Number(value.toFixed(6)))).toEqual([
			-1, -0.8, -0.6, -0.4, -0.2
		]);
	});

	it('regenerates after the cache is cleared for that context, and only that context', () => {
		const fake = createFakeAudioContext();
		const other = createFakeAudioContext();
		const context = asBaseAudioContext(fake);
		const otherContext = asBaseAudioContext(other);
		const buffer = getWhiteNoiseBuffer(context);
		const otherBuffer = getWhiteNoiseBuffer(otherContext);

		clearNoiseBufferCache(context);

		expect(getWhiteNoiseBuffer(context)).not.toBe(buffer);
		expect(getWhiteNoiseBuffer(otherContext)).toBe(otherBuffer);
	});
});
