<script lang="ts">
	/** Compact native select specimen. Production callers supply their own SVG/glyph option labels. */
	const uid = $props.id();
	const selectId = `${uid}-selector`;
	let selection = $state('~');
</script>

<label class="selector-switch" for={selectId}>
	<span>Wave</span>
	<select id={selectId} bind:value={selection} aria-label="Waveform">
		<option value="~">~</option>
		<option value="□">□</option>
		<option value="△">△</option>
	</select>
</label>

<style>
	.selector-switch {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	select {
		width: 34px;
		height: 22px;
		padding: 0 2px 0 5px;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: var(--font-size-base);
		line-height: 1;
		cursor: pointer;
	}

	select:hover {
		background: var(--color-surface);
	}
	select:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	/* Narrow viewport tightens spacing only — this stays a fine-pointer desktop control
	   (00-conventions.md §5 rules touch-target sizing out of scope), so the select never grows here. */
	@media (max-width: 640px) {
		.selector-switch {
			gap: var(--space-1);
		}
	}
</style>
