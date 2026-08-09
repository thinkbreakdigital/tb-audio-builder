<script lang="ts">
	/** Static excluded-channel list; selection is visual only for the /ui catalog. */
	const channels = [
		{ name: 'Marker track', role: 'META' },
		{ name: 'Reference click', role: 'IGNORED' }
	];
	let selectedIndex = $state(0);
</script>

<section class="unassigned-list" aria-labelledby="unassigned-title">
	<header>
		<h3 id="unassigned-title">Not included in playback</h3>
		<span>{channels.length}</span>
	</header>
	<ul>
		{#each channels as channel, index (channel.name)}
			<li>
				<button
					type="button"
					class:selected={selectedIndex === index}
					aria-current={selectedIndex === index ? 'true' : undefined}
					onclick={() => (selectedIndex = index)}
				>
					<span>{channel.name}</span><span class="role">{channel.role}</span>
				</button>
			</li>
		{/each}
	</ul>
</section>

<style>
	.unassigned-list {
		width: min(100%, 300px);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--control-height);
		padding: 0 var(--space-2);
		border-bottom: var(--border-width) solid var(--color-border);
		color: var(--color-text-muted);
	}

	h3 {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: 400;
	}

	header span,
	.role {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--control-height);
		padding: var(--space-1) var(--space-2);
		border: 0;
		border-bottom: var(--border-width) solid var(--color-border);
		border-left: 2px solid transparent;
		background: none;
		color: var(--color-text-muted);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 100ms,
			color 100ms;
	}

	li:last-child button {
		border-bottom: 0;
	}

	button:hover,
	button.selected {
		background: var(--color-surface);
		color: var(--color-text);
	}

	button.selected {
		border-left-color: var(--color-accent);
		font-weight: 700;
	}

	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: -2px;
	}

	@media (max-width: 640px) {
		.unassigned-list {
			width: 100%;
		}
		button {
			min-height: 36px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
