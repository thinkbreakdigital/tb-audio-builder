<div class="status-region" aria-live="polite" role="status">
	<span class="marker" aria-hidden="true"></span>
	<span>Project saved locally</span>
	<span class="detail">just now</span>
</div>

<style>
	.status-region {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--control-height);
		padding: 0 var(--space-3);
		border-top: var(--border-width) solid var(--color-border);
		color: var(--color-text);
		font-size: var(--font-size-sm);
	}
	.marker {
		width: 7px;
		height: 7px;
		border: var(--border-width) solid var(--color-success);
		background: var(--color-success);
	}
	.detail {
		color: var(--color-text-muted);
	}
	@media (max-width: 640px) {
		.status-region {
			min-height: 36px;
			flex-wrap: wrap;
			padding-block: var(--space-1);
		}
	}
</style>
