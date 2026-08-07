<script lang="ts">
	import type { Snippet } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import StatusRegion from '$lib/components/StatusRegion.svelte';
	import '$lib/styles/global.css';

	let { children }: { children: Snippet } = $props();
</script>

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
