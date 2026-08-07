<script lang="ts">
	interface SelectOption {
		value: string;
		label: string;
	}

	interface Props {
		label: string;
		value: string;
		options: SelectOption[];
		id: string;
		disabled?: boolean;
		class?: string;
		onchange?: (event: Event) => void;
	}

	let {
		label,
		value = $bindable(),
		options,
		id,
		disabled = false,
		class: className = '',
		onchange
	}: Props = $props();
</script>

<div class="field {className}">
	<label for={id}>{label}</label>
	<select {id} bind:value {disabled} {onchange}>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	select {
		height: var(--control-height);
		padding: 0 var(--space-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
	}

	select:disabled {
		background: var(--color-surface);
		color: var(--color-text-muted);
		cursor: not-allowed;
	}
</style>
