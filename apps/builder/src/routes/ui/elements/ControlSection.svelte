<script lang="ts">
	/** Flat, bordered grouping treatment; content is demonstrative only. */
</script>

<fieldset class="control-section">
	<legend>Oscillator</legend>
	<div class="controls">
		<div class="control"><span>Wave</span><output>~</output></div>
		<div class="control"><span>Level</span><output>0.80</output></div>
	</div>
</fieldset>

<style>
	.control-section {
		/* Canonical --control-column footprint (00-conventions.md §5.4):
		   border 1 + pad 4 + legend 16 + control row 1fr + pad 4 + border 1 = 128.
		   The controls inside are exactly 96 tall and start-aligned; the leftover 6px is
		   container slack, which §5.4 permits. Modules stay exact, containers absorb. */
		display: flex;
		flex-direction: column;
		gap: 0;
		min-width: 0;
		height: var(--band-4);
		margin: 0;
		padding: var(--pad-1);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	legend {
		min-height: var(--label-line);
		padding: 0 var(--pad-1);
		color: var(--color-text);
		font-size: var(--font-size-sm);
		font-weight: 700;
	}

	.controls {
		display: flex;
		flex: 1;
		align-items: start;
		gap: 0;
		min-width: 0;
	}

	.control {
		display: grid;
		gap: var(--pad-1);
		padding: 0 var(--pad-2);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	output {
		min-width: 4ch;
		color: var(--color-text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 640px) {
		.control-section {
			width: 100%;
			box-sizing: border-box;
		}
	}
</style>
