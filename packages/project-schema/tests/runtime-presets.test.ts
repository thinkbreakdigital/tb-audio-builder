import { PERCUSSION_PRESETS, PITCHED_PRESETS } from '@thinkbreak/audio-runtime';
import { describe, expect, it } from 'vitest';
import {
	PercussionInstrumentDefinitionSchema,
	PitchedInstrumentDefinitionSchema
} from '../src/index.js';

describe('audio-runtime preset schema conformance', () => {
	it('validates every pitched preset against the published schema', () => {
		for (const preset of PITCHED_PRESETS) {
			expect(PitchedInstrumentDefinitionSchema.safeParse(preset.definition).success).toBe(true);
		}
	});

	it('validates every percussion preset against the published schema', () => {
		for (const preset of PERCUSSION_PRESETS) {
			expect(PercussionInstrumentDefinitionSchema.safeParse(preset.definition).success).toBe(true);
		}
	});
});
