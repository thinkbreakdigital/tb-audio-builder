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
	</div>
</section>

<style>
	.strip-rail {
		width: min(100%, 420px);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		height: var(--control-height);
		padding: 0 var(--space-2);
		border-bottom: var(--border-width) solid var(--color-border);
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
		gap: var(--space-2);
		overflow-x: auto;
		padding: var(--space-2);
		scrollbar-color: var(--color-border-strong) var(--color-background);
	}

	.rail:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.rail :global(.channel-strip) {
		flex: 0 0 auto;
	}

	@media (max-width: 640px) {
		.strip-rail {
			width: 100%;
		}
		.rail {
			padding-bottom: var(--space-3);
		}
	}
</style>
