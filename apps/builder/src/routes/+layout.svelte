<script lang="ts">
	import type { Snippet } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import StatusRegion from '$lib/components/StatusRegion.svelte';
	import '$lib/styles/global.css';

	let { children }: { children: Snippet } = $props();

	// Dropping a file anywhere outside MidiDropZone must not navigate the browser away from the
	// app; both dragover and drop have to be prevented for that.
	function preventNavigation(event: DragEvent) {
		event.preventDefault();
	}
</script>

<svelte:document ondragover={preventNavigation} ondrop={preventNavigation} />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app">
	{@render children()}
	<StatusRegion />
</div>

<style>
	.app {
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		height: 100dvh;
		overflow: hidden;
	}
</style>
