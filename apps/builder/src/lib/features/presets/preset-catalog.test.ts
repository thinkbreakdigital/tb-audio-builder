import {
	createDefaultPercussionInstrument,
	createDefaultPitchedInstrument
} from '@thinkbreak/audio-runtime';
import { InstrumentPresetSchema } from '@thinkbreak/project-schema';
import { describe, expect, it } from 'vitest';
import {
	canDeleteInstrumentPreset,
	canOverwriteInstrumentPreset,
	createBuiltInInstrumentPresets,
	createCustomInstrumentPreset,
	findAdjacentPreset,
	orderInstrumentPresets,
	resolveInstrumentPreset,
	sameInstrumentDefinitionIgnoringProvenance
} from './preset-catalog.js';

describe('preset catalog', () => {
	it('exposes seven fresh valid factory presets for each instrument type', () => {
		const first = createBuiltInInstrumentPresets();
		const second = createBuiltInInstrumentPresets();
		expect(first.filter((preset) => preset.type === 'pitched')).toHaveLength(7);
		expect(first.filter((preset) => preset.type === 'percussion')).toHaveLength(7);
		for (const preset of first) expect(InstrumentPresetSchema.safeParse(preset).success).toBe(true);
		first[0]!.definition.presetId = null;
		expect(second[0]!.definition.presetId).not.toBeNull();
	});

	it('resolves provenance, custom records, and modified definitions without comparing preset ids', () => {
		const presets = createBuiltInInstrumentPresets();
		const original = createDefaultPitchedInstrument();
		expect(resolveInstrumentPreset(original, presets)).toMatchObject({
			name: 'Square Lead',
			modified: false
		});
		const changed = { ...original, filter: { ...original.filter, q: 4 } };
		expect(resolveInstrumentPreset(changed, presets).modified).toBe(true);
		expect(resolveInstrumentPreset({ ...original, presetId: 'deleted' }, presets)).toMatchObject({
			name: 'Custom',
			modified: false
		});
		expect(
			sameInstrumentDefinitionIgnoringProvenance(original, { ...original, presetId: null })
		).toBe(true);
	});

	it('orders/searches deterministically and wraps previous/next navigation', () => {
		const user = createCustomInstrumentPreset({
			id: '3dfe2b0e-7ba0-484a-a92a-2fd3b9242502',
			name: 'Amber lead',
			definition: createDefaultPitchedInstrument(),
			nowMs: 1
		});
		const ordered = orderInstrumentPresets({ type: 'pitched', user: [user] });
		expect(ordered[0]!.builtIn).toBe(true);
		expect(ordered.at(-1)!.id).toBe(user.id);
		expect(orderInstrumentPresets({ type: 'pitched', user: [user], query: 'AMBER' })).toMatchObject(
			[{ id: user.id }]
		);
		expect(findAdjacentPreset([user], user.id, 'next')).toMatchObject({ id: user.id });
		expect(findAdjacentPreset(ordered, ordered[0]!.id, 'previous')).toMatchObject({
			id: ordered.at(-1)!.id
		});
	});

	it('creates validated user presets and protects factory records', () => {
		const custom = createCustomInstrumentPreset({
			id: '3dfe2b0e-7ba0-484a-a92a-2fd3b9242502',
			name: '  My kick  ',
			definition: createDefaultPercussionInstrument(),
			nowMs: 1
		});
		expect(custom.name).toBe('My kick');
		expect(custom.definition.presetId).toBe(custom.id);
		expect(() =>
			createCustomInstrumentPreset({ id: 'not-a-uuid', name: 'No', definition: custom.definition })
		).toThrow();
		const factory = createBuiltInInstrumentPresets()[0]!;
		expect(canOverwriteInstrumentPreset(factory)).toBe(false);
		expect(canDeleteInstrumentPreset(factory)).toBe(false);
		expect(canOverwriteInstrumentPreset(custom)).toBe(true);
	});
});
