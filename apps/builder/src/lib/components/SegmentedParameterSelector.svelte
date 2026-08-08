<script lang="ts">
	export interface SegmentedOption {
		value: string;
		shortLabel: string;
		label: string;
	}

	interface Props {
		id: string;
		label: string;
		value: string;
		options: readonly SegmentedOption[];
		disabled?: boolean;
		onchange?: (value: string) => void;
	}

	let { id, label, value, options, disabled = false, onchange }: Props = $props();
	const selectedIndex = $derived(
		Math.max(
			0,
			options.findIndex((option) => option.value === value)
		)
	);
	const selectedLabel = $derived(options[selectedIndex]?.label ?? 'No parameter selected');
</script>

<fieldset class="selector" {disabled}>
	<legend class="visually-hidden">{label}</legend>
	<div class="selector-heading">
		<span class="selector-label">{label}</span>
		<span class="active-name" aria-live="polite">{selectedLabel}</span>
	</div>
	<div
		class="segments"
		style={`--segment-count: ${Math.max(1, options.length)}; --selected-index: ${selectedIndex}`}
	>
		<span class="active-indicator" aria-hidden="true"></span>
		{#each options as option (option.value)}
			<div class="segment">
				<input
					type="radio"
					name={id}
					id={`${id}-${option.value}`}
					value={option.value}
					checked={option.value === value}
					onchange={() => onchange?.(option.value)}
				/>
				<label for={`${id}-${option.value}`} title={option.label}>
					<span aria-hidden="true">{option.shortLabel}</span>
					<span class="visually-hidden">{option.label}</span>
					<span class="helper" aria-hidden="true">{option.label}</span>
				</label>
			</div>
		{/each}
	</div>
</fieldset>

<style>
	.selector {
		min-width: 0;
		padding: 0;
		margin: 0;
		border: 0;
	}

	.selector-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
		margin-bottom: var(--space-1);
		font-size: var(--font-size-sm);
	}

	.selector-label {
		font-weight: 600;
	}

	.active-name {
		overflow: hidden;
		color: var(--color-text-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.segments {
		position: relative;
		display: grid;
		grid-template-columns: repeat(var(--segment-count), minmax(0, 1fr));
		height: 20px;
		padding: 2px;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: 10px;
		background: var(--color-surface-active);
	}

	.active-indicator {
		position: absolute;
		top: 2px;
		bottom: 2px;
		left: 2px;
		width: calc((100% - 4px) / var(--segment-count));
		border-radius: 8px;
		background: var(--color-accent);
		transform: translateX(calc(var(--selected-index) * 100%));
		transition: transform 100ms ease-out;
	}

	.segment {
		position: relative;
		z-index: 1;
		min-width: 0;
	}

	.segment input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}

	.segment label {
		position: relative;
		display: flex;
		height: 14px;
		align-items: center;
		justify-content: center;
		border-radius: 7px;
		color: var(--color-text-muted);
		font-size: 9px;
		font-weight: 800;
		line-height: 1;
		text-transform: uppercase;
		cursor: pointer;
	}

	.segment input:checked + label {
		color: var(--color-accent-text);
	}

	.segment input:focus-visible + label {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	.helper {
		position: absolute;
		z-index: 2;
		bottom: calc(100% + 7px);
		left: 50%;
		display: none;
		padding: 3px 5px;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
		font-size: 10px;
		font-weight: 500;
		text-transform: none;
		white-space: nowrap;
		transform: translateX(-50%);
	}

	.segment label:hover .helper,
	.segment input:focus-visible + label .helper {
		display: block;
	}

	.selector:disabled {
		opacity: 0.6;
	}

	.selector:disabled label {
		cursor: not-allowed;
	}

	@media (prefers-reduced-motion: reduce) {
		.active-indicator {
			transition: none;
		}
	}
</style>
