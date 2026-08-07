<script lang="ts">
	interface Props {
		label: string;
		checked: boolean;
		id: string;
		disabled?: boolean;
		class?: string;
		onchange?: (event: Event) => void;
	}

	let {
		label,
		checked = $bindable(),
		id,
		disabled = false,
		class: className = '',
		onchange
	}: Props = $props();
</script>

<div class="field {className}">
	<input type="checkbox" {id} bind:checked {disabled} {onchange} />
	<label for={id}>{label}</label>
</div>

<style>
	.field {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	input {
		width: var(--space-4);
		height: var(--space-4);
		accent-color: var(--color-accent);
	}

	input:disabled {
		cursor: not-allowed;
	}

	label {
		color: var(--color-text);
	}

	input:disabled + label {
		color: var(--color-text-muted);
	}
</style>
