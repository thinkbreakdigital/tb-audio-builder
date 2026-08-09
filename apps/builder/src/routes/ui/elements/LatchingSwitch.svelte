<script lang="ts">
	/** Local-only mixer latch specimen; pressed styles retain fill, border, and weight changes. */
	export interface Props {
		solo?: boolean;
		mute?: boolean;
		label?: string;
	}

	let {
		solo = $bindable(false),
		mute = $bindable(false),
		label = 'Channel latches'
	}: Props = $props();
</script>

<div class="latching-switch" role="group" aria-label={label}>
	<button
		type="button"
		class:pressed={solo}
		class:solo
		aria-pressed={solo}
		onclick={() => (solo = !solo)}
	>
		S<span class="sr-only">olo</span>
	</button>
	<button
		type="button"
		class:pressed={mute}
		class:mute
		aria-pressed={mute}
		onclick={() => (mute = !mute)}
	>
		M<span class="sr-only">ute</span>
	</button>
</div>

<style>
	.latching-switch {
		display: inline-flex;
		gap: var(--space-1);
	}
	button {
		width: 24px;
		height: 24px;
		padding: 0;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		font-weight: 400;
		cursor: pointer;
		transition:
			background-color 100ms,
			border-color 100ms,
			color 100ms;
	}
	button:hover {
		background: var(--color-surface);
	}
	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}
	button.pressed {
		color: var(--color-accent-text);
		font-weight: 700;
		border-width: 2px;
	}
	button.solo.pressed {
		background: var(--color-warning);
		border-color: var(--color-warning);
	}
	button.mute.pressed {
		background: var(--color-danger);
		border-color: var(--color-danger);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}
	/* Narrow viewport tightens spacing only — this stays a fine-pointer desktop control
	   (00-conventions.md §5 rules touch-target sizing out of scope), so the buttons never grow here. */
	@media (max-width: 640px) {
		.latching-switch {
			gap: 2px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
