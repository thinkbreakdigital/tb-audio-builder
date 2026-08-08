import type { InstrumentDefinition } from '@thinkbreak/audio-runtime';
import type { InstrumentPreset } from '@thinkbreak/project-schema';
import {
	cloneInstrumentPreset,
	createBuiltInInstrumentPresets,
	createCustomInstrumentPreset,
	normalizePresetName,
	type PresetType
} from './preset-catalog.js';

const MAX_CUSTOM_PRESETS = 100;

export interface CustomPresetStore {
	list(type?: PresetType): InstrumentPreset[];
	get(id: string): InstrumentPreset | null;
	save(input: { name: string; definition: InstrumentDefinition }): InstrumentPreset;
	overwrite(
		id: string,
		input: { name: string; definition: InstrumentDefinition }
	): InstrumentPreset;
	remove(id: string): void;
}

export function createCustomPresetStore(
	options: {
		idGenerator?: () => string;
		nowMs?: () => number;
	} = {}
): CustomPresetStore {
	const idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
	const nowMs = options.nowMs ?? (() => Date.now());
	const presets = new Map<string, InstrumentPreset>();
	const factoryIds = new Set(createBuiltInInstrumentPresets().map((preset) => preset.id));

	function requireUserPreset(id: string, action: string): InstrumentPreset {
		if (factoryIds.has(id)) {
			throw new Error(`Cannot ${action} factory preset "${id}".`);
		}
		const preset = presets.get(id);
		if (preset === undefined)
			throw new Error(`Cannot ${action}: custom preset "${id}" was not found.`);
		return preset;
	}

	return {
		list(type?: PresetType): InstrumentPreset[] {
			return [...presets.values()]
				.filter((preset) => type === undefined || preset.type === type)
				.sort(
					(left, right) =>
						left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
						left.id.localeCompare(right.id)
				)
				.map(cloneInstrumentPreset);
		},

		get(id: string): InstrumentPreset | null {
			const preset = presets.get(id);
			return preset === undefined ? null : cloneInstrumentPreset(preset);
		},

		save(input): InstrumentPreset {
			const name = normalizePresetName(input.name);
			if (presets.size >= MAX_CUSTOM_PRESETS) {
				throw new Error(
					`Cannot save preset: the in-memory limit of ${MAX_CUSTOM_PRESETS} presets was reached.`
				);
			}
			const id = idGenerator();
			if (presets.has(id)) {
				throw new Error(`Cannot save preset: generated custom preset id "${id}" already exists.`);
			}
			const preset = createCustomInstrumentPreset({
				name,
				definition: input.definition,
				id,
				nowMs: nowMs()
			});
			presets.set(preset.id, preset);
			return cloneInstrumentPreset(preset);
		},

		overwrite(id, input): InstrumentPreset {
			const previous = requireUserPreset(id, 'overwrite');
			const next = createCustomInstrumentPreset({
				name: normalizePresetName(input.name),
				definition: input.definition,
				id,
				nowMs: nowMs()
			});
			const updated: InstrumentPreset = {
				...next,
				createdAtMs: previous.createdAtMs,
				updatedAtMs: Math.max(next.updatedAtMs, previous.updatedAtMs)
			};
			presets.set(id, updated);
			return cloneInstrumentPreset(updated);
		},

		remove(id: string): void {
			requireUserPreset(id, 'delete');
			presets.delete(id);
		}
	};
}

export const customPresetStore = createCustomPresetStore();
