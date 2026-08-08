import {
	PERCUSSION_PRESETS,
	PITCHED_PRESETS,
	type InstrumentDefinition
} from '@thinkbreak/audio-runtime';
import { InstrumentPresetSchema, type InstrumentPreset } from '@thinkbreak/project-schema';

export type PresetType = InstrumentPreset['type'];
export type PresetGroup = 'factory' | 'user';
export type PresetDirection = 'previous' | 'next';

export interface ResolvedInstrumentPreset {
	name: string;
	preset: InstrumentPreset | null;
	modified: boolean;
}

export function normalizePresetName(name: string): string {
	const normalized = name.trim();
	if (normalized.length === 0) throw new Error('Preset name cannot be blank.');
	if (normalized.length > 200) throw new Error('Preset name must be 200 characters or fewer.');
	return normalized;
}

/** Returns new schema-valid records and definitions on every call; factory templates never leak. */
export function createBuiltInInstrumentPresets(nowMs: number = 0): InstrumentPreset[] {
	return [...PITCHED_PRESETS, ...PERCUSSION_PRESETS].map((preset) =>
		InstrumentPresetSchema.parse({
			id: preset.id,
			name: preset.name,
			type: preset.type,
			definition: structuredClone(preset.definition),
			builtIn: true,
			createdAtMs: nowMs,
			updatedAtMs: nowMs
		})
	);
}

export function createCustomInstrumentPreset(input: {
	name: string;
	definition: InstrumentDefinition;
	nowMs?: number;
	id?: string;
}): InstrumentPreset {
	const id = input.id ?? crypto.randomUUID();
	const nowMs = input.nowMs ?? Date.now();
	const definition = structuredClone(input.definition);
	definition.presetId = id;
	return InstrumentPresetSchema.parse({
		id,
		name: normalizePresetName(input.name),
		type: definition.kind,
		definition,
		builtIn: false,
		createdAtMs: nowMs,
		updatedAtMs: nowMs
	});
}

export function cloneInstrumentPreset(preset: InstrumentPreset): InstrumentPreset {
	return structuredClone(InstrumentPresetSchema.parse(preset));
}

export function groupForPreset(preset: InstrumentPreset): PresetGroup {
	return preset.builtIn ? 'factory' : 'user';
}

/** Factory first, then User; each group is ordered by name and stable ID for deterministic navigation. */
export function orderInstrumentPresets(input: {
	type: PresetType;
	factory?: readonly InstrumentPreset[];
	user?: readonly InstrumentPreset[];
	query?: string;
}): InstrumentPreset[] {
	const query = (input.query ?? '').trim().toLocaleLowerCase();
	const presets = [...(input.factory ?? createBuiltInInstrumentPresets()), ...(input.user ?? [])]
		.filter((preset) => preset.type === input.type)
		.filter((preset) => query === '' || preset.name.toLocaleLowerCase().includes(query))
		.map(cloneInstrumentPreset);
	return presets.sort((left, right) => {
		const groupOrder = Number(left.builtIn) - Number(right.builtIn);
		if (groupOrder !== 0) return -groupOrder;
		return (
			left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
			left.id.localeCompare(right.id)
		);
	});
}

export function findAdjacentPreset(
	presets: readonly InstrumentPreset[],
	currentPresetId: string | null,
	direction: PresetDirection
): InstrumentPreset | null {
	if (currentPresetId === null || presets.length === 0) return null;
	const currentIndex = presets.findIndex((preset) => preset.id === currentPresetId);
	if (currentIndex < 0) return null;
	const nextIndex =
		direction === 'next'
			? (currentIndex + 1) % presets.length
			: (currentIndex - 1 + presets.length) % presets.length;
	const preset = presets[nextIndex];
	return preset === undefined ? null : cloneInstrumentPreset(preset);
}

export function resolveInstrumentPreset(
	definition: InstrumentDefinition,
	presets: readonly InstrumentPreset[]
): ResolvedInstrumentPreset {
	const preset = presets.find(
		(candidate) => candidate.id === definition.presetId && candidate.type === definition.kind
	);
	if (preset === undefined) return { name: 'Custom', preset: null, modified: false };
	return {
		name: preset.name,
		preset: cloneInstrumentPreset(preset),
		modified: !sameInstrumentDefinitionIgnoringProvenance(definition, preset.definition)
	};
}

export function sameInstrumentDefinitionIgnoringProvenance(
	left: InstrumentDefinition,
	right: InstrumentDefinition
): boolean {
	if (left.kind !== right.kind) return false;
	const comparableLeft = structuredClone(left);
	const comparableRight = structuredClone(right);
	comparableLeft.presetId = null;
	comparableRight.presetId = null;
	return JSON.stringify(comparableLeft) === JSON.stringify(comparableRight);
}

export function canOverwriteInstrumentPreset(preset: InstrumentPreset): boolean {
	return !preset.builtIn;
}

export function canDeleteInstrumentPreset(preset: InstrumentPreset): boolean {
	return !preset.builtIn;
}
