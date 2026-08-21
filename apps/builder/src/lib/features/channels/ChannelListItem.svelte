<script lang="ts">
	import type { AudioChannelDefinition, ChannelRole } from '@thinkbreak/audio-runtime';

	interface Props {
		channel: AudioChannelDefinition;
		noteCount: number;
		selected: boolean;
		tabIndexValue: 0 | -1;
		buttonEl?: HTMLButtonElement;
		onselect: () => void;
		onkeydown: (event: KeyboardEvent) => void;
	}

	let {
		channel,
		noteCount,
		selected,
		tabIndexValue,
		buttonEl = $bindable(),
		onselect,
		onkeydown
	}: Props = $props();

	const ROLE_BADGES: Record<ChannelRole, string> = {
		pitched: 'PITCHED',
		percussion: 'PERC',
		ignored: 'IGNORED',
		metadata: 'META'
	};
</script>

<li>
	<button
		bind:this={buttonEl}
		type="button"
		class="channel"
		class:selected
		class:disabled={!channel.enabled}
		aria-current={selected ? 'true' : undefined}
		tabindex={tabIndexValue}
		onclick={onselect}
		{onkeydown}
	>
		<span class="channel-name">{channel.name}{channel.enabled ? '' : ' (disabled)'}</span>
		<span class="badge">{ROLE_BADGES[channel.role]}</span>
		<span class="note-count">{noteCount} note{noteCount === 1 ? '' : 's'}</span>
		{#if channel.mix.muted}<span class="marker">MUTE</span>{/if}
		{#if channel.mix.soloed}<span class="marker">SOLO</span>{/if}
	</button>
</li>

<style>
	.channel {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--control-height);
		padding: var(--space-1) var(--space-2);
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

	.channel.disabled .channel-name {
		color: var(--color-text-muted);
	}

	.note-count {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
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
