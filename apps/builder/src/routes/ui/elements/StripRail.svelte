<script lang="ts">
	import ChannelStrip from './ChannelStrip.svelte';

	/** The rail deliberately keeps its fixed-width strips and exposes scroll overflow. */
</script>

<section class="strip-rail" aria-labelledby="rail-title">
	<header>
		<h3 id="rail-title">Channels</h3>
		<span>Scroll for more</span>
	</header>
	<div class="rail" aria-labelledby="rail-title">
		<ChannelStrip />
		<ChannelStrip />
		<ChannelStrip />
		<ChannelStrip />
	</div>
</section>

<style>
	.strip-rail {
		box-sizing: border-box;
		width: min(100%, var(--mod-16));
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	header {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		height: var(--band-1);
		padding: 0 var(--pad-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius) var(--radius) 0 0;
	}

	h3 {
		margin: 0;
		font-size: var(--font-size-base);
	}

	header span {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.rail {
		display: flex;
		gap: 0;
		overflow-x: auto;
		padding: 0;
		scrollbar-color: var(--color-border-strong) var(--color-background);
	}

	.rail:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.rail :global(.channel-strip) {
		flex: 0 0 var(--mod-4);
		border-block-start-width: 0;
		border-radius: 0;
		padding-block-start: var(--border-width);
	}

	.rail :global(.channel-strip + .channel-strip) {
		border-inline-start-width: 0;
		padding-inline-start: var(--border-width);
	}

	.rail :global(.channel-strip:first-child) {
		border-end-start-radius: var(--radius);
	}

	.rail :global(.channel-strip:last-child) {
		border-end-end-radius: var(--radius);
	}
</style>
