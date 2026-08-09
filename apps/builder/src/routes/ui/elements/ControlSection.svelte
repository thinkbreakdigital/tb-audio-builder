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
		display: grid;
		gap: var(--space-2);
		min-width: 0;
		margin: 0;
		padding: var(--space-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	legend {
		padding: 0 var(--space-1);
		color: var(--color-text);
		font-size: var(--font-size-sm);
		font-weight: 700;
	}

	.controls {
		display: flex;
		gap: var(--space-3);
	}

	.control {
		display: grid;
		gap: var(--space-1);
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
