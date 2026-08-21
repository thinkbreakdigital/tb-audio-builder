<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import { statusState } from '$lib/state/status.svelte.js';
	import { runMidiImport } from './run-import.js';

	let dragActive = $state(false);
	let importing = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();
	let dragDepth = 0;

	const promptText = $derived(
		importing ? 'Importing…' : dragActive ? 'Release to import' : 'Drop a .mid file here'
	);

	function openPicker() {
		if (importing) return;
		inputEl?.click();
	}

	async function runImport(file: File) {
		importing = true;
		try {
			await runMidiImport(file);
		} finally {
			importing = false;
		}
	}

	function handleDragEnter(event: DragEvent) {
		event.preventDefault();
		if (importing) return;
		dragDepth += 1;
		dragActive = true;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) dragActive = false;
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragDepth = 0;
		dragActive = false;
		if (importing) return;

		const files = event.dataTransfer?.files;
		if (files === undefined || files.length === 0) return;
		if (files.length > 1) {
			statusState.push(
				'warning',
				`MIDI import needs exactly one file; ${files.length} files were dropped.`
			);
			return;
		}

		const file = files[0];
		if (!file) return;
		await runImport(file);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (importing) return;
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		openPicker();
	}

	async function handleChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		input.value = '';
		if (!file) return;
		await runImport(file);
	}
</script>

<div
	class="drop-zone"
	class:drag-active={dragActive}
	role="button"
	tabindex={importing ? -1 : 0}
	aria-disabled={importing}
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onkeydown={handleKeydown}
>
	<p class="prompt">{promptText}</p>
	<Button onclick={openPicker} disabled={importing}>Choose file…</Button>
	<input
		bind:this={inputEl}
		type="file"
		accept=".mid,.midi"
		class="visually-hidden"
		tabindex="-1"
		onchange={handleChange}
	/>
</div>

<style>
	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		padding: var(--space-6);
		border: var(--border-width) dashed var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		text-align: center;
		transition: border-color 100ms;
	}

	.drop-zone.drag-active {
		border-color: var(--color-accent);
		border-style: solid;
	}

	.drop-zone[aria-disabled='true'] {
		opacity: 0.5;
	}

	.prompt {
		margin: 0;
		color: var(--color-text);
	}
</style>
