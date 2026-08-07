<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import TextField from '$lib/components/TextField.svelte';
	import { projectState } from '$lib/state/project.svelte.js';
	import { statusState } from '$lib/state/status.svelte.js';
	import { syncState } from '$lib/state/sync.svelte.js';
	import { uiState } from '$lib/state/ui.svelte.js';

	const NEW_PROJECT_NAME = 'Untitled project';
	const PROJECT_NAME_MAX_LENGTH = 120;

	function handleRename(event: Event) {
		const input = event.target as HTMLInputElement;
		projectState.rename(input.value);
	}

	function handleNewProject() {
		projectState.createNew(NEW_PROJECT_NAME);
		uiState.setSelectedChannelId(null);
		statusState.push('info', `Created project "${NEW_PROJECT_NAME}".`);
	}
</script>

<header class="project-bar">
	<span class="app-name">ThinkBreak Web Audio Builder</span>
	<TextField
		class="project-name"
		label="Project name"
		id="project-name"
		value={projectState.project?.name ?? ''}
		disabled={projectState.project === null}
		maxlength={PROJECT_NAME_MAX_LENGTH}
		onchange={handleRename}
	/>
	<span class="sync-label">{syncState.label}</span>
	<Button onclick={handleNewProject}>New project</Button>
</header>

<style>
	.project-bar {
		display: flex;
		grid-column: 1 / -1;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-3);
		border-bottom: var(--border-width) solid var(--color-border);
		background: var(--color-surface);
	}

	.app-name {
		font-weight: 600;
		white-space: nowrap;
	}

	/* Layout-only override of the field's default stacked label; the bar is a single 40px row. */
	.project-bar :global(.project-name) {
		flex-direction: row;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}

	.sync-label {
		margin-left: auto;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		white-space: nowrap;
	}
</style>
