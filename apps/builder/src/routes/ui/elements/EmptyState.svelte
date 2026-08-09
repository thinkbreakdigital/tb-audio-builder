<script lang="ts">
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
		display: flex;
		width: min(230px, 100%);
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4);
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
		height: 26px;
		padding: 0 var(--space-2);
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
	@media (max-width: 640px) {
		.empty-state {
			width: 100%;
			padding: var(--space-3);
		}
		button {
			height: var(--control-height);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
