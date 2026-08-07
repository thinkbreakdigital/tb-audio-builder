<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ChannelList from '$lib/features/channels/ChannelList.svelte';
	import { projectState } from '$lib/state/project.svelte.js';
</script>

<nav class="channel-sidebar" aria-label="Channels">
	<h2>Channels</h2>
	{#if projectState.channels.length === 0}
		<EmptyState message="No MIDI imported yet." />
	{:else}
		<ChannelList />
	{/if}
</nav>

<style>
	.channel-sidebar {
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow-y: auto;
		border-right: var(--border-width) solid var(--color-border);
		background: var(--color-background);
	}

	/* Height matches the MainPanel tab bar so the two header rows align. */
	h2 {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		height: calc(var(--control-height) + var(--border-width));
		margin: 0;
		padding: 0 var(--space-3);
		border-bottom: var(--border-width) solid var(--color-border);
		font-size: var(--font-size-sm);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}
</style>
