<script lang="ts">
	interface Props {
		label: string;
		value: string;
		id: string;
		disabled?: boolean;
		maxlength?: number;
		error?: string;
		class?: string;
		onchange?: (event: Event) => void;
	}

	let {
		label,
		value = $bindable(),
		id,
		disabled = false,
		maxlength,
		error,
		class: className = '',
		onchange
	}: Props = $props();

	const errorId = $derived(`${id}-error`);
</script>

<div class="field {className}">
	<label for={id}>{label}</label>
	<input
		type="text"
		{id}
		bind:value
		{disabled}
		{maxlength}
		{onchange}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? errorId : undefined}
	/>
	{#if error}
		<p id={errorId} class="error">{error}</p>
	{/if}
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

	input {
		height: var(--control-height);
		padding: 0 var(--space-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
	}

	input:disabled {
		background: var(--color-surface);
		color: var(--color-text-muted);
		cursor: not-allowed;
	}

	input[aria-invalid='true'] {
		border-color: var(--color-danger);
	}

	.error {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-danger);
	}
</style>
