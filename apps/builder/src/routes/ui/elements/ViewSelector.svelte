<script lang="ts">
	/**
	 * The application's two top-level views, represented locally in the catalog.
	 *
	 * Modular footprint (00-conventions.md §5.4): each tab is min-width var(--mod-2) (64px), height
	 * one band (var(--control-height), 32px), and the tabs butt together at gap: 0. Padding is baked
	 * into each tab from the default control-module scale (--pad-2, 8px). The second and later tabs
	 * drop their inline-start border and add that 1px to their inline-start padding — the same
	 * butted-seam rule LatchingSwitch uses — so a run of tabs reads as one 1px border between them,
	 * not two.
	 */
	type View = 'instrument' | 'mixer';
	const uid = $props.id();
	let selected = $state<View>('instrument');

	function tabId(view: View) {
		return `${uid}-${view}-tab`;
	}

	function panelId(view: View) {
		return `${uid}-${view}-panel`;
	}
</script>

<div class="view-selector">
	<div role="tablist" aria-label="Main view">
		{#each [{ value: 'instrument', label: 'Instrument' }, { value: 'mixer', label: 'Mixer' }] as view (view.value)}
			<button
				id={tabId(view.value as View)}
				type="button"
				role="tab"
				aria-selected={selected === view.value}
				aria-controls={panelId(view.value as View)}
				tabindex={selected === view.value ? 0 : -1}
				onclick={() => (selected = view.value as View)}
			>
				{view.label}
			</button>
		{/each}
	</div>
	<div id={panelId(selected)} role="tabpanel" aria-labelledby={tabId(selected)}>
		{selected === 'instrument' ? 'Sound controls' : 'Global channel mix'}
	</div>
</div>

<style>
	.view-selector {
		display: grid;
		gap: var(--space-2);
		font-size: var(--font-size-sm);
	}

	[role='tablist'] {
		display: inline-flex;
		gap: 0;
	}

	button {
		box-sizing: border-box;
		min-width: var(--mod-2);
		height: var(--control-height);
		padding: 0 var(--pad-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: 0;
		background: var(--color-background);
		color: var(--color-text-muted);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 100ms,
			color 100ms;
	}

	/* Run start: keeps its full border and the outer-left corner radius. */
	button:first-child {
		border-start-start-radius: var(--radius);
		border-end-start-radius: var(--radius);
	}

	/* Butted seam (00-conventions.md §5.4): every tab after the first drops its inline-start border
	   and adds that 1px to its inline-start padding, so the run's total width is unchanged and the
	   shared edge reads as one 1px line rather than two. */
	button + button {
		border-inline-start-width: 0;
		padding-inline-start: calc(var(--pad-2) + 1px);
	}

	/* Run end: keeps the outer-right corner radius. */
	button:last-child {
		border-start-end-radius: var(--radius);
		border-end-end-radius: var(--radius);
	}

	button[aria-selected='true'] {
		background: var(--color-accent);
		color: var(--color-accent-text);
	}

	button:hover {
		background: var(--color-surface-active);
		color: var(--color-text);
	}

	button[aria-selected='true']:hover {
		background: var(--color-accent);
		color: var(--color-accent-text);
	}

	button:focus-visible {
		position: relative;
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	[role='tabpanel'] {
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}

	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
