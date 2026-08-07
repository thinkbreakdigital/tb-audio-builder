<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'primary' | 'danger';
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		onclick?: (event: MouseEvent) => void;
		children?: Snippet;
	}

	let {
		variant = 'default',
		disabled = false,
		type = 'button',
		class: className = '',
		onclick,
		children
	}: Props = $props();
</script>

<button {type} class="button button-{variant} {className}" {disabled} {onclick}>
	{@render children?.()}
</button>

<style>
	.button {
		height: var(--control-height);
		padding: 0 var(--space-3);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
		transition: background-color 100ms;
	}

	.button:hover:not(:disabled) {
		background: var(--color-surface-active);
	}

	.button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.button-primary {
		background: var(--color-accent);
		color: var(--color-accent-text);
		border-color: var(--color-accent);
	}

	.button-primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-accent) 85%, var(--color-text) 15%);
	}

	.button-danger {
		background: var(--color-danger);
		color: var(--color-accent-text);
		border-color: var(--color-danger);
	}

	.button-danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-danger) 85%, var(--color-text) 15%);
	}
</style>
