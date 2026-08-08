import {
	createDefaultPercussionInstrument,
	createDefaultPitchedInstrument
} from '@thinkbreak/audio-runtime';
import { describe, expect, it } from 'vitest';
import { createCustomPresetStore } from './custom-preset-store.js';

describe('custom preset store', () => {
	it('creates independent Save As records with normalized names and UUID ids', () => {
		const store = createCustomPresetStore({
			idGenerator: () => '3dfe2b0e-7ba0-484a-a92a-2fd3b9242502',
			nowMs: () => 10
		});
		const saved = store.save({ name: '  Lead  ', definition: createDefaultPitchedInstrument() });
		expect(saved).toMatchObject({
			id: '3dfe2b0e-7ba0-484a-a92a-2fd3b9242502',
			name: 'Lead',
			builtIn: false,
			createdAtMs: 10
		});
		saved.definition.presetId = null;
		expect(store.get(saved.id)?.definition.presetId).toBe(saved.id);
		expect(() => store.save({ name: ' ', definition: createDefaultPitchedInstrument() })).toThrow(
			/cannot be blank/
		);
	});

	it('overwrites only custom presets and rejects factory/unknown destructive operations', () => {
		let nowMs = 10;
		const store = createCustomPresetStore({
			idGenerator: () => '3dfe2b0e-7ba0-484a-a92a-2fd3b9242502',
			nowMs: () => nowMs
		});
		const saved = store.save({ name: 'Lead', definition: createDefaultPitchedInstrument() });
		nowMs = 20;
		const overwritten = store.overwrite(saved.id, {
			name: 'Drum',
			definition: createDefaultPercussionInstrument()
		});
		expect(overwritten).toMatchObject({
			id: saved.id,
			name: 'Drum',
			type: 'percussion',
			createdAtMs: 10,
			updatedAtMs: 20
		});
		expect(() =>
			store.overwrite('square-lead', { name: 'No', definition: overwritten.definition })
		).toThrow(/factory preset/);
		expect(() => store.remove('square-lead')).toThrow(/factory preset/);
		expect(() => store.remove('missing')).toThrow(/was not found/);
		store.remove(saved.id);
		expect(store.get(saved.id)).toBeNull();
	});
});
