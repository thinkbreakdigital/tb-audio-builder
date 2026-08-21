<script lang="ts">
	/** Static patch-navigation specimen for the /ui catalog. */
	interface Props {
		embedded?: boolean;
	}

	let { embedded = false }: Props = $props();
	let modified = $state(true);
	let patchName = $state('Vintage Electric Piano With a Deliberately Long Patch Name');
</script>

<section class="patch-header" class:embedded aria-label="Patch controls">
	<div class="patch-navigation">
		<button type="button" aria-label="Previous patch" title="Previous patch">‹</button>
		<div class="patch-title" title={patchName}>
			<span class="name">{patchName}</span>
			{#if modified}<span class="modified">Modified</span>{/if}
		</div>
		<button type="button" aria-label="Next patch" title="Next patch">›</button>
	</div>
	<div class="actions">
		<button type="button" onclick={() => (modified = !modified)}>Browse</button>
		<button type="button">Save As</button>
	</div>
</section>

<style>
	.patch-header {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: min(100%, var(--mod-12));
		min-width: 0;
		padding: var(--pad-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	.patch-header.embedded {
		flex: 1 1 auto;
		width: 100%;
	}

	.patch-navigation,
	.actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}

	.patch-navigation {
		flex: 1 1 auto;
	}

	.actions {
		flex: 0 0 auto;
	}

	.patch-title {
		display: flex;
		flex: 1;
		gap: var(--space-2);
		min-width: 0;
		align-items: baseline;
		padding: 0 var(--pad-1);
	}

	.name {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.modified {
		flex: 0 0 auto;
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	button {
		flex: 0 0 auto;
		height: var(--control-height);
		padding: 0 var(--pad-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
		cursor: pointer;
		white-space: nowrap;
		transition: background-color 100ms;
	}

	.patch-navigation button {
		width: var(--control-height);
		padding: 0;
		font-family: var(--font-mono);
		font-size: var(--font-size-lg);
		font-weight: 700;
	}

	button:hover {
		background: var(--color-surface-active);
	}

	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
