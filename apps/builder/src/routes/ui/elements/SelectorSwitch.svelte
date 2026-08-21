<script lang="ts">
	/**
	 * Compact native select specimen. Production callers supply their own SVG/glyph option labels.
	 *
	 * Modular footprint (00-conventions.md §5.4): 64x64 (--mod-2 x --band-2). Three stacked rows —
	 * label (16), the select's band (32), and a reserved row (16) — sum to the full 64px height with
	 * zero gap between them, the same label+band+reserved shape as ToggleSwitch. The band is itself
	 * padding 4 (--pad-1) + the 24px-tall select + padding 4 vertically, and padding 8 (--pad-2) + the
	 * 48px-wide select + padding 8 horizontally: 4 + 24 + 4 = 32, 8 + 48 + 8 = 64. The reserved row
	 * carries no content today; it exists so a future state readout can occupy it without changing the
	 * module's footprint, per §5.4's "a validation message MUST NOT change a module's footprint".
	 */
	const uid = $props.id();
	const selectId = `${uid}-selector`;
	let selection = $state('~');
</script>

<label class="selector-switch" for={selectId}>
	<span class="label">Wave</span>
	<span class="control">
		<select id={selectId} bind:value={selection} aria-label="Waveform">
			<option value="~">~</option>
			<option value="□">□</option>
			<option value="△">△</option>
		</select>
	</span>
	<span class="reserved" aria-hidden="true"></span>
</label>

<style>
	.selector-switch {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0;
		width: var(--mod-2);
		height: var(--band-2);
		padding: 0;
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.label {
		box-sizing: border-box;
		height: var(--label-line);
		overflow: hidden;
		line-height: var(--label-line);
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* The 32px band: padding 4 (--pad-1) top/bottom, padding 8 (--pad-2) left/right, around the
	   48x24 select — 4 + 24 + 4 = 32 vertically, 8 + 48 + 8 = 64 horizontally. */
	.control {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		height: var(--band-1);
		padding: var(--pad-1) var(--pad-2);
	}

	/* No token exists for a 48x24 select — the size is specified directly by 00-conventions.md §5.4's
	   canonical footprint table, not derived from a reusable dial/segment token. */
	select {
		box-sizing: border-box;
		width: 48px;
		height: 24px;
		padding: 0 4px;
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

	.reserved {
		box-sizing: border-box;
		height: var(--readout-line);
	}
</style>
