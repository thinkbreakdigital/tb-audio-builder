<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ChannelHeaderPanel from '$lib/features/channels/ChannelHeaderPanel.svelte';
	import ImportSummary from '$lib/features/midi-import/ImportSummary.svelte';
	import MidiDropZone from '$lib/features/midi-import/MidiDropZone.svelte';
	import { projectState } from '$lib/state/project.svelte.js';
	import { uiState, type MainView } from '$lib/state/ui.svelte.js';

	interface Tab {
		id: MainView;
		label: string;
	}

	const TABS: Tab[] = [
		{ id: 'instrument', label: 'Instrument' },
		{ id: 'mixer', label: 'Mixer' }
	];

	let tabElements = $state<(HTMLButtonElement | undefined)[]>([]);

	function selectTabAt(index: number) {
		const tab = TABS[index];
		if (tab === undefined) return;
		uiState.setMainView(tab.id);
		tabElements[index]?.focus();
	}

	function handleTabKeydown(event: KeyboardEvent, index: number) {
		let nextIndex: number | null = null;
		if (event.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
		else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
		else if (event.key === 'Home') nextIndex = 0;
		else if (event.key === 'End') nextIndex = TABS.length - 1;
		if (nextIndex === null) return;
		event.preventDefault();
		selectTabAt(nextIndex);
	}

	const hasSong = $derived(projectState.project?.song != null);
</script>

<main class="main-panel">
	<div class="tab-bar" role="tablist" aria-label="Editor views">
		{#each TABS as tab, index (tab.id)}
			<button
				bind:this={tabElements[index]}
				type="button"
				role="tab"
				id="tab-{tab.id}"
				class="tab"
				class:selected={uiState.mainView === tab.id}
				aria-selected={uiState.mainView === tab.id}
				aria-controls="panel-{tab.id}"
				tabindex={uiState.mainView === tab.id ? 0 : -1}
				onclick={() => uiState.setMainView(tab.id)}
				onkeydown={(event) => handleTabKeydown(event, index)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<div
		class="tab-body"
		role="tabpanel"
		id="panel-instrument"
		aria-labelledby="tab-instrument"
		hidden={uiState.mainView !== 'instrument'}
	>
		{#if !hasSong}
			<MidiDropZone />
		{:else}
			{#if uiState.selectedChannelId !== null}
				<ChannelHeaderPanel />
				<EmptyState message="Instrument editing arrives in a later phase." />
			{:else}
				<EmptyState message="Select a channel to edit its instrument." />
			{/if}
			<!-- Import auto-selects a channel, so gating the summary on an empty selection would
			     leave it unreachable after a normal import. -->
			<ImportSummary />
		{/if}
	</div>

	<div
		class="tab-body"
		role="tabpanel"
		id="panel-mixer"
		aria-labelledby="tab-mixer"
		hidden={uiState.mainView !== 'mixer'}
	>
		<EmptyState message="The mixer appears once a project has channels." />
	</div>
</main>

<style>
	.main-panel {
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow-y: auto;
		background: var(--color-background);
	}

	.tab-bar {
		display: flex;
		flex: 0 0 auto;
		border-bottom: var(--border-width) solid var(--color-border);
		background: var(--color-surface);
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

	.tab:hover {
		background: var(--color-surface-active);
	}

	.tab.selected {
		border-bottom-color: var(--color-accent);
		background: var(--color-background);
		color: var(--color-text);
		font-weight: 600;
	}

	.tab-body {
		flex: 1;
		min-height: 0;
		padding: var(--space-3);
		overflow-y: auto;
	}

	.tab-body[hidden] {
		display: none;
	}
</style>
