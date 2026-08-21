<script lang="ts">
	/**
	 * Modular footprint (00-conventions.md §5.4): width var(--mod-7) (224px, down from 230px),
	 * clamped to the viewport via min() rather than a resizing media query. The internal button's
	 * ~26px height becomes var(--control-height), one band.
	 */
	let selected = $state(false);
</script>

<section class="empty-state" aria-labelledby="empty-state-title">
	<p id="empty-state-title">No channel selected</p>
	<p class="detail">Choose a channel to edit its instrument.</p>
	<button type="button" onclick={() => (selected = true)}
		>{selected ? 'Channel selected' : 'Select channel'}</button
	>
</section>

<style>
	.empty-state {
		box-sizing: border-box;
		display: flex;
		width: min(var(--mod-7), 100%);
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--pad-3);
		color: var(--color-text-muted);
		text-align: center;
	}
	p {
		margin: 0;
	}
	.detail {
		font-size: var(--font-size-sm);
	}
	button {
		box-sizing: border-box;
		height: var(--control-height);
		padding: 0 var(--pad-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: transparent;
		color: var(--color-text-muted);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
		transition:
			border-color 100ms,
			color 100ms;
	}
	button:hover {
		border-color: var(--color-text-muted);
		color: var(--color-text);
	}
	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
