<script lang="ts">
	/** Native disclosure specimen for rarely used ignored/metadata channel state. */
</script>

<details class="advanced-drawer">
	<summary>Advanced — ignored / metadata state</summary>
	<div class="drawer-content">
		<p>This channel is not included in playback.</p>
		<dl>
			<div>
				<dt>Role</dt>
				<dd>Metadata</dd>
			</div>
			<div>
				<dt>Instrument</dt>
				<dd>None</dd>
			</div>
		</dl>
	</div>
</details>

<style>
	.advanced-drawer {
		width: min(100%, 300px);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	summary {
		min-height: var(--control-height);
		padding: var(--space-1) var(--space-2);
		color: var(--color-text);
		font-size: var(--font-size-sm);
		font-weight: 700;
		cursor: pointer;
	}

	summary:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.drawer-content {
		padding: var(--space-2);
		border-top: var(--border-width) solid var(--color-border);
	}

	p {
		margin: 0 0 var(--space-2);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	dl {
		display: grid;
		gap: var(--space-1);
		margin: 0;
	}

	dl div {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
	}

	dt {
		color: var(--color-text-muted);
	}

	dd {
		margin: 0;
		color: var(--color-text);
	}

	@media (max-width: 640px) {
		.advanced-drawer {
			width: 100%;
		}
		summary {
			min-height: 36px;
		}
	}
</style>
