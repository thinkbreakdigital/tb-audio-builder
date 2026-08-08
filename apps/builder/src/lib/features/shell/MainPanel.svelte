<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ChannelHeaderPanel from '$lib/features/channels/ChannelHeaderPanel.svelte';
	import ImportSummary from '$lib/features/midi-import/ImportSummary.svelte';
	import MidiDropZone from '$lib/features/midi-import/MidiDropZone.svelte';
	import { projectState } from '$lib/state/project.svelte.js';
	import { uiState, type ChannelTab, type MainView } from '$lib/state/ui.svelte.js';

	interface MainTabDefinition {
		id: MainView;
		label: string;
	}

	interface ChannelTabDefinition {
		id: ChannelTab;
		label: string;
	}

	const MAIN_TABS: readonly MainTabDefinition[] = [
		{ id: 'channel-editor', label: 'Channel Editor' },
		{ id: 'mixer-overview', label: 'Mixer Overview' }
	];
	const CHANNEL_TABS: readonly ChannelTabDefinition[] = [
		{ id: 'instrument', label: 'Instrument' },
		{ id: 'mixer', label: 'Mixer' }
	];

	let mainTabElements = $state<(HTMLButtonElement | undefined)[]>([]);
	let channelTabElements = $state<(HTMLButtonElement | undefined)[]>([]);

	function requestedTabIndex(event: KeyboardEvent, index: number, length: number): number | null {
		if (event.key === 'ArrowRight') return (index + 1) % length;
		if (event.key === 'ArrowLeft') return (index - 1 + length) % length;
		if (event.key === 'Home') return 0;
		if (event.key === 'End') return length - 1;
		return null;
	}

	function handleMainTabKeydown(event: KeyboardEvent, index: number): void {
		const nextIndex = requestedTabIndex(event, index, MAIN_TABS.length);
		if (nextIndex === null) return;
		event.preventDefault();
		const tab = MAIN_TABS[nextIndex];
		if (tab === undefined) return;
		uiState.setMainView(tab.id);
		mainTabElements[nextIndex]?.focus();
	}

	function handleChannelTabKeydown(event: KeyboardEvent, index: number): void {
		const nextIndex = requestedTabIndex(event, index, CHANNEL_TABS.length);
		if (nextIndex === null) return;
		event.preventDefault();
		const tab = CHANNEL_TABS[nextIndex];
		if (tab === undefined) return;
		uiState.setChannelTab(tab.id);
		channelTabElements[nextIndex]?.focus();
	}

	const hasSong = $derived(projectState.project?.song != null);
	const hasSelectedChannel = $derived(
		projectState.channels.some((channel) => channel.id === uiState.selectedChannelId)
	);
</script>

<main class="main-panel">
	<div class="tab-bar main-tabs" role="tablist" aria-label="Workspace views">
		{#each MAIN_TABS as tab, index (tab.id)}
			<button
				bind:this={mainTabElements[index]}
				type="button"
				role="tab"
				id={`main-tab-${tab.id}`}
				class="tab"
				class:selected={uiState.mainView === tab.id}
				aria-selected={uiState.mainView === tab.id}
				aria-controls={`main-panel-${tab.id}`}
				tabindex={uiState.mainView === tab.id ? 0 : -1}
				onclick={() => uiState.setMainView(tab.id)}
				onkeydown={(event) => handleMainTabKeydown(event, index)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<div
		class="main-tab-panel"
		role="tabpanel"
		id="main-panel-channel-editor"
		aria-labelledby="main-tab-channel-editor"
		hidden={uiState.mainView !== 'channel-editor'}
	>
		{#if !hasSong}
			<div class="panel-padding">
				<MidiDropZone />
			</div>
		{:else}
			{#if hasSelectedChannel}
				<div class="header-padding"><ChannelHeaderPanel /></div>
			{/if}

			<div class="tab-bar channel-tabs" role="tablist" aria-label="Selected channel views">
				{#each CHANNEL_TABS as tab, index (tab.id)}
					<button
						bind:this={channelTabElements[index]}
						type="button"
						role="tab"
						id={`channel-tab-${tab.id}`}
						class="tab compact"
						class:selected={uiState.channelTab === tab.id}
						aria-selected={uiState.channelTab === tab.id}
						aria-controls={`channel-panel-${tab.id}`}
						tabindex={uiState.channelTab === tab.id ? 0 : -1}
						onclick={() => uiState.setChannelTab(tab.id)}
						onkeydown={(event) => handleChannelTabKeydown(event, index)}
					>
						{tab.label}
					</button>
				{/each}
			</div>

			<div
				class="channel-tab-panel panel-padding"
				role="tabpanel"
				id="channel-panel-instrument"
				aria-labelledby="channel-tab-instrument"
				hidden={uiState.channelTab !== 'instrument'}
			>
				{#if hasSelectedChannel}
					<EmptyState message="Instrument controls arrive in phase 09." />
				{:else}
					<EmptyState message="Select a channel to edit its instrument." />
				{/if}
				<ImportSummary />
			</div>

			<div
				class="channel-tab-panel panel-padding"
				role="tabpanel"
				id="channel-panel-mixer"
				aria-labelledby="channel-tab-mixer"
				hidden={uiState.channelTab !== 'mixer'}
			>
				<EmptyState
					message={hasSelectedChannel
						? 'Channel mixing controls arrive in phase 10.'
						: 'Select a channel to mix.'}
				/>
			</div>
		{/if}
	</div>

	<div
		class="main-tab-panel panel-padding"
		role="tabpanel"
		id="main-panel-mixer-overview"
		aria-labelledby="main-tab-mixer-overview"
		hidden={uiState.mainView !== 'mixer-overview'}
	>
		<EmptyState message="Mixer Overview arrives in phase 10." />
	</div>
</main>

<style>
	.main-panel {
		display: flex;
		min-height: 0;
		flex-direction: column;
		overflow: hidden;
		background: var(--color-background);
	}

	.tab-bar {
		display: flex;
		flex: 0 0 auto;
		border-bottom: var(--border-width) solid var(--color-border);
		background: var(--color-surface);
	}

	.channel-tabs {
		padding-left: var(--space-3);
		border-top: var(--border-width) solid var(--color-border);
		background: var(--color-background);
	}

	.tab {
		height: var(--control-height);
		padding: 0 var(--space-3);
		border: 0;
		border-right: var(--border-width) solid var(--color-border);
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background-color 100ms;
	}

	.tab.compact {
		height: 26px;
		font-size: var(--font-size-sm);
	}

	.tab:hover {
		background: var(--color-surface-active);
	}

	.tab.selected {
		border-bottom-color: var(--color-accent);
		background: var(--color-background);
		color: var(--color-text);
		font-weight: 600;
	}

	.main-tab-panel {
		min-height: 0;
		flex: 1;
		overflow-y: auto;
	}

	.main-tab-panel[hidden],
	.channel-tab-panel[hidden] {
		display: none;
	}

	.header-padding,
	.panel-padding {
		padding: var(--space-3);
	}

	.header-padding {
		padding-bottom: 0;
	}

	.channel-tab-panel {
		min-height: 0;
	}
</style>
