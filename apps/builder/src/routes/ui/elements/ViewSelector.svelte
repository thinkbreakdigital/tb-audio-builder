<script lang="ts">
	/** The application's two top-level views, represented locally in the catalog. */
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
		width: fit-content;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	button {
		height: var(--control-height);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--color-text-muted);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 100ms,
			color 100ms;
	}

	button + button {
		border-left: var(--border-width) solid var(--color-border-strong);
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

	@media (max-width: 640px) {
		button {
			min-height: 36px;
			padding: 0 var(--space-4);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
