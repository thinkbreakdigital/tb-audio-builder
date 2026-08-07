<script lang="ts">
	interface Props {
		pressed: boolean;
		label: string;
		class?: string;
		onclick?: (event: MouseEvent) => void;
	}

	let { pressed, label, class: className = '', onclick }: Props = $props();
</script>

<button type="button" class="toggle {className}" class:pressed aria-pressed={pressed} {onclick}>
	{label}
</button>

<style>
	.toggle {
		height: var(--control-height);
		padding: 0 var(--space-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
		font-weight: 400;
		cursor: pointer;
		transition:
			background-color 100ms,
			border-color 100ms;
	}

	.toggle:hover {
		background: var(--color-surface);
	}

	.toggle.pressed {
		background: var(--color-surface-active);
		border-color: var(--color-border-strong);
		font-weight: 700;
	}
</style>
