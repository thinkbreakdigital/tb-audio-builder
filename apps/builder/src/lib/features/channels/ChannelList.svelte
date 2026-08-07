<script lang="ts">
	import type { AudioChannelDefinition } from '@thinkbreak/audio-runtime';
	import { projectState } from '$lib/state/project.svelte.js';
	import { uiState } from '$lib/state/ui.svelte.js';
	import ChannelListItem from './ChannelListItem.svelte';

	const channels = $derived(projectState.channels);
	const selectedIndex = $derived(
		channels.findIndex((channel) => channel.id === uiState.selectedChannelId)
	);
	const activeIndex = $derived(selectedIndex >= 0 ? selectedIndex : 0);

	let itemRefs = $state<(HTMLButtonElement | undefined)[]>([]);

	function noteCountFor(channel: AudioChannelDefinition): number {
		return (
			projectState.project?.song?.tracks.find((track) => track.id === channel.sourceTrackId)?.notes
				.length ?? 0
		);
	}

	function selectAt(index: number) {
		const channel = channels[index];
		if (!channel) return;
		uiState.setSelectedChannelId(channel.id);
		itemRefs[index]?.focus();
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		let nextIndex: number | null = null;
		if (event.key === 'ArrowDown') nextIndex = Math.min(index + 1, channels.length - 1);
		else if (event.key === 'ArrowUp') nextIndex = Math.max(index - 1, 0);
		else if (event.key === 'Home') nextIndex = 0;
		else if (event.key === 'End') nextIndex = channels.length - 1;
		if (nextIndex === null || nextIndex === index) return;
		event.preventDefault();
		selectAt(nextIndex);
	}
</script>

<ul>
	{#each channels as channel, index (channel.id)}
		<ChannelListItem
			{channel}
			noteCount={noteCountFor(channel)}
			selected={index === selectedIndex}
			tabIndexValue={index === activeIndex ? 0 : -1}
			bind:buttonEl={itemRefs[index]}
			onselect={() => uiState.setSelectedChannelId(channel.id)}
			onkeydown={(event) => handleKeydown(event, index)}
		/>
	{/each}
</ul>

<style>
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
