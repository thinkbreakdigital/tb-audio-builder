<script lang="ts">
	import type { ChannelRole } from '@thinkbreak/audio-runtime';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { projectState } from '$lib/state/project.svelte.js';
	import { uiState } from '$lib/state/ui.svelte.js';

	const ROLE_BADGES: Record<ChannelRole, string> = {
		pitched: 'PITCHED',
		percussion: 'PERC',
		ignored: 'IGNORED',
		metadata: 'META'
	};
</script>

<nav class="channel-sidebar" aria-label="Channels">
	<h2>Channels</h2>
	{#if projectState.channels.length === 0}
		<EmptyState message="No MIDI imported yet." />
	{:else}
		<ul>
			{#each projectState.channels as channel (channel.id)}
				{@const selected = uiState.selectedChannelId === channel.id}
				<li>
					<button
						type="button"
						class="channel"
						class:selected
						aria-current={selected ? 'true' : undefined}
						onclick={() => uiState.setSelectedChannelId(channel.id)}
					>
						<span class="channel-name">{channel.name}</span>
						<span class="badge">{ROLE_BADGES[channel.role]}</span>
						{#if channel.mix.muted}<span class="marker">MUTE</span>{/if}
						{#if channel.mix.soloed}<span class="marker">SOLO</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
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

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.channel {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--control-height);
		padding: var(--space-1) var(--space-3);
		border: 0;
		border-bottom: var(--border-width) solid var(--color-border);
		border-left: 2px solid transparent;
		background: none;
		text-align: left;
		cursor: pointer;
		transition: background-color 100ms;
	}

	.channel:hover {
		background: var(--color-surface);
	}

	.channel.selected {
		border-left-color: var(--color-accent);
		background: var(--color-surface-active);
	}

	.channel-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.badge,
	.marker {
		padding: 0 var(--space-1);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.marker {
		font-weight: 700;
		color: var(--color-text);
	}
</style>
