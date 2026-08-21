<!--
	Modular footprint (00-conventions.md §5.4): full width, one band tall (var(--control-height),
	32px) — the same elastic-row treatment as the shell's status/transport bars, not a fixed module
	count.
-->
<div class="status-region" aria-live="polite" role="status">
	<span class="marker" aria-hidden="true"></span>
	<span>Project saved locally</span>
	<span class="detail">just now</span>
</div>

<style>
	.status-region {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		height: var(--control-height);
		padding: 0 var(--pad-3);
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
</style>
