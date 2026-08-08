<script lang="ts">
	import ParameterKnob from './ParameterKnob.svelte';
	import SegmentedParameterSelector from './SegmentedParameterSelector.svelte';
	import type { ParameterScale } from './parameter-knob.js';

	export interface ParameterBankOption {
		key: string;
		shortLabel: string;
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		fineStep?: number;
		unit: string;
		decimals?: number;
		scale?: ParameterScale;
		defaultValue: number;
		formatValue?: (value: number) => string;
	}

	interface Props {
		id: string;
		label: string;
		selectedKey: string;
		options: readonly ParameterBankOption[];
		disabled?: boolean;
		onselect: (key: string) => void;
		onlive?: (key: string, value: number) => void;
		oncommit?: (key: string, value: number) => void;
	}

	let {
		id,
		label,
		selectedKey,
		options,
		disabled = false,
		onselect,
		onlive,
		oncommit
	}: Props = $props();

	const selectedOption = $derived(
		options.find((option) => option.key === selectedKey) ?? options[0]
	);
	const selectorOptions = $derived(
		options.map((option) => ({
			value: option.key,
			shortLabel: option.shortLabel,
			label: option.label
		}))
	);
</script>

<div class="parameter-bank">
	<SegmentedParameterSelector
		id={`${id}-selector`}
		{label}
		value={selectedOption?.key ?? ''}
		options={selectorOptions}
		{disabled}
		onchange={onselect}
	/>

	{#if selectedOption}
		<ParameterKnob
			id={`${id}-${selectedOption.key}`}
			label={selectedOption.label}
			value={selectedOption.value}
			min={selectedOption.min}
			max={selectedOption.max}
			step={selectedOption.step}
			fineStep={selectedOption.fineStep}
			unit={selectedOption.unit}
			decimals={selectedOption.decimals}
			scale={selectedOption.scale}
			defaultValue={selectedOption.defaultValue}
			formatValue={selectedOption.formatValue}
			{disabled}
			onlive={(value) => onlive?.(selectedOption.key, value)}
			oncommit={(value) => oncommit?.(selectedOption.key, value)}
		/>
	{:else}
		<p class="configuration-error" role="alert">No parameters are configured for {label}.</p>
	{/if}
</div>

<style>
	.parameter-bank {
		display: inline-flex;
		min-width: 112px;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
	}

	.parameter-bank :global(.selector) {
		width: 100%;
	}

	.configuration-error {
		max-width: 160px;
		margin: 0;
		color: var(--color-danger);
		font-size: var(--font-size-sm);
	}
</style>
