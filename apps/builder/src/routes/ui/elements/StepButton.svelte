<script lang="ts">
	/**
	 * Preset step controls with a persistent text cue for arrow meanings.
	 *
	 * Modular footprint (00-conventions.md §5.4): each button is 32x32, var(--control-height) on both
	 * axes — one band square, already aligned to the grid.
	 */
	let patchNumber = $state(3);

	function step(amount: number) {
		patchNumber = Math.max(1, patchNumber + amount);
	}
</script>

<div class="step-button" role="group" aria-label="Patch navigation">
	<button type="button" aria-label="Previous patch" title="Previous patch" onclick={() => step(-1)}>
		<span aria-hidden="true">‹</span>
	</button>
	<span class="patch" aria-live="polite">Patch {patchNumber}</span>
	<button type="button" aria-label="Next patch" title="Next patch" onclick={() => step(1)}>
		<span aria-hidden="true">›</span>
	</button>
</div>

<style>
	.step-button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	button {
		box-sizing: border-box;
		width: var(--control-height);
		height: var(--control-height);
		padding: 0;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
		font-size: var(--font-size-lg);
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		transition:
			background-color 100ms,
			border-color 100ms;
	}

	button:hover {
		background: var(--color-surface);
	}

	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.patch {
		min-width: 7ch;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
