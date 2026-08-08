import { describe, expect, it } from 'vitest';
import {
	applyAttackDecaySustain,
	applyRelease,
	MIN_ENVELOPE_RAMP_SECONDS
} from '../src/synth/envelope.js';
import type { AdsrSettings } from '../src/synth/envelope.js';
import { asFakeGainNode, createFakeAudioContext } from './fakes/fake-audio-context.js';
import type { FakeAudioParam, FakeAutomationCall } from './fakes/fake-audio-context.js';

const SETTINGS: AdsrSettings = {
	attackSeconds: 0.02,
	decaySeconds: 0.05,
	sustainLevel: 0.5,
	releaseSeconds: 0.3
};

/** The fake and the production code meet at `AudioParam`; this is the single cast per test. */
function createParam(): { param: AudioParam; automation: readonly FakeAutomationCall[] } {
	const fake = createFakeAudioContext();
	const gain = asFakeGainNode(fake.createGain()).gain;
	return {
		// `unknown` cast: FakeAudioParam is structurally partial — see fake-audio-context.ts.
		param: gain as unknown as AudioParam,
		automation: gain.automation
	};
}

function callsOf(
	automation: readonly FakeAutomationCall[],
	method: FakeAutomationCall['method']
): readonly FakeAutomationCall[] {
	return automation.filter((call) => call.method === method);
}

describe('applyAttackDecaySustain', () => {
	it('schedules attack and decay at the exact times computed from the settings', () => {
		const { param, automation } = createParam();

		applyAttackDecaySustain({ param, startAtSeconds: 4, peakValue: 0.8, settings: SETTINGS });

		expect(automation.map((call) => [call.method, call.value])).toEqual([
			['cancelScheduledValues', 1],
			['setValueAtTime', 0],
			['linearRampToValueAtTime', 0.8],
			['linearRampToValueAtTime', 0.4]
		]);
		expect(automation.map((call) => call.atSeconds)).toEqual([
			4,
			4,
			expect.closeTo(4.02, 10),
			expect.closeTo(4.07, 10)
		]);
	});

	it('gives a zero-length attack the 1ms floor rather than a discontinuity', () => {
		const { param, automation } = createParam();

		applyAttackDecaySustain({
			param,
			startAtSeconds: 0,
			peakValue: 1,
			settings: { ...SETTINGS, attackSeconds: 0, decaySeconds: 0 }
		});

		const ramps = callsOf(automation, 'linearRampToValueAtTime');
		expect(ramps[0]?.atSeconds).toBeCloseTo(MIN_ENVELOPE_RAMP_SECONDS, 10);
		expect(ramps[1]?.atSeconds).toBeCloseTo(2 * MIN_ENVELOPE_RAMP_SECONDS, 10);
	});

	it('decays to silence when sustainLevel is 0, giving a percussive shape', () => {
		const { param, automation } = createParam();

		applyAttackDecaySustain({
			param,
			startAtSeconds: 0,
			peakValue: 0.9,
			settings: { ...SETTINGS, sustainLevel: 0 }
		});

		expect(callsOf(automation, 'linearRampToValueAtTime')[1]?.value).toBe(0);
	});
});

describe('applyRelease', () => {
	it('returns releaseAtSeconds + releaseSeconds and ramps to zero there', () => {
		const { param, automation } = createParam();
		applyAttackDecaySustain({ param, startAtSeconds: 0, peakValue: 0.8, settings: SETTINGS });

		const endSeconds = applyRelease({ param, releaseAtSeconds: 1, settings: SETTINGS });

		expect(endSeconds).toBeCloseTo(1.3, 10);
		const lastCall = automation[automation.length - 1];
		expect(lastCall).toEqual({
			method: 'linearRampToValueAtTime',
			value: 0,
			atSeconds: endSeconds
		});
	});

	it('applies the 1ms floor to a zero-length release', () => {
		const { param } = createParam();

		const endSeconds = applyRelease({
			param,
			releaseAtSeconds: 2,
			settings: { ...SETTINGS, releaseSeconds: 0 }
		});

		expect(endSeconds).toBeCloseTo(2 + MIN_ENVELOPE_RAMP_SECONDS, 10);
	});

	it('runs from the value the decay reached, including a sustainLevel of 0', () => {
		const { param, automation } = createParam();
		const settings: AdsrSettings = { ...SETTINGS, sustainLevel: 0 };
		applyAttackDecaySustain({ param, startAtSeconds: 0, peakValue: 0.9, settings });

		applyRelease({ param, releaseAtSeconds: 1, settings });

		const anchor = callsOf(automation, 'setValueAtTime').at(-1);
		expect(anchor).toEqual({ method: 'setValueAtTime', value: 0, atSeconds: 1 });
	});

	it('anchors on the caller-supplied level when the envelope has not sounded yet', () => {
		const { param, automation } = createParam();
		applyAttackDecaySustain({ param, startAtSeconds: 10, peakValue: 0.8, settings: SETTINGS });

		applyRelease({ param, releaseAtSeconds: 11, settings: SETTINGS, fromValue: 0.25 });

		expect(callsOf(automation, 'setValueAtTime').at(-1)?.value).toBe(0.25);
	});
});

describe('envelope automation ordering', () => {
	it('schedules every call in non-decreasing time order across a full note', () => {
		const { param, automation } = createParam();

		applyAttackDecaySustain({ param, startAtSeconds: 1, peakValue: 0.8, settings: SETTINGS });
		applyRelease({ param, releaseAtSeconds: 3, settings: SETTINGS });

		const times = automation.map((call) => call.atSeconds);
		expect(times).toEqual([...times].sort((a, b) => a - b));
	});

	it('keeps ordering when every segment collapses to the 1ms floor', () => {
		const { param, automation } = createParam();
		const settings: AdsrSettings = {
			attackSeconds: 0,
			decaySeconds: 0,
			sustainLevel: 0.5,
			releaseSeconds: 0
		};

		applyAttackDecaySustain({ param, startAtSeconds: 0, peakValue: 1, settings });
		applyRelease({ param, releaseAtSeconds: 0.5, settings });

		const times = automation.map((call) => call.atSeconds);
		expect(times).toEqual([...times].sort((a, b) => a - b));
	});
});

describe('AudioParam contract', () => {
	it('is driven entirely through the AudioParam interface, never a direct value write', () => {
		const fake = createFakeAudioContext();
		const gain = asFakeGainNode(fake.createGain());
		const param: FakeAudioParam = gain.gain;

		applyAttackDecaySustain({
			// `unknown` cast: see fake-audio-context.ts.
			param: param as unknown as AudioParam,
			startAtSeconds: 0,
			peakValue: 1,
			settings: SETTINGS
		});

		// Every value the param holds arrived through a recorded automation call.
		expect(param.automation.length).toBe(4);
	});
});
