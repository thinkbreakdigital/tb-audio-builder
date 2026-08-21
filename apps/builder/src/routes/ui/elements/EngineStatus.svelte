<script lang="ts">
	/**
	 * Modular footprint (00-conventions.md §5.4): full width, one band tall (var(--control-height),
	 * 32px). The Resume button now shares that same 32px band instead of the previous 24px height.
	 */
	let state = $state<'suspended' | 'running'>('suspended');
</script>

<div class="engine-status" role="status" aria-live="polite">
	<span>{state === 'suspended' ? 'Audio is paused.' : 'Audio is ready.'}</span>
	{#if state === 'suspended'}
		<button type="button" onclick={() => (state = 'running')}>Resume audio</button>
	{:else}
		<span class="ready">Ready</span>
	{/if}
</div>

<style>
	.engine-status {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		height: var(--control-height);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}
	button {
		box-sizing: border-box;
		height: var(--control-height);
		padding: 0 var(--pad-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-size: inherit;
		cursor: pointer;
		transition: background-color 100ms;
	}
	button:hover {
		background: var(--color-surface-active);
	}
	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	.ready {
		color: var(--color-success);
		font-weight: 700;
	}
	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
