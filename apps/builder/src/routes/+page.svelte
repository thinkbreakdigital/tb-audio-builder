<script lang="ts">
	import ChannelSidebar from '$lib/features/shell/ChannelSidebar.svelte';
	import LandingScreen from '$lib/features/shell/LandingScreen.svelte';
	import MainPanel from '$lib/features/shell/MainPanel.svelte';
	import ProjectBar from '$lib/features/shell/ProjectBar.svelte';
	import TransportBar from '$lib/features/shell/TransportBar.svelte';

	const FADE_MS = 350;

	let landingMounted = $state(true);
	let landingFading = $state(false);
	let workspaceElement = $state<HTMLDivElement>();
	let fadeTimeoutId: ReturnType<typeof setTimeout> | undefined;

	function prefersReducedMotion(): boolean {
		if (typeof matchMedia !== 'function') return false;
		return matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function handleStart() {
		if (landingFading) return;
		landingFading = true;
		fadeTimeoutId = setTimeout(
			() => {
				landingMounted = false;
				// The landing was holding focus; hand it to the workspace so the keyboard path continues.
				workspaceElement?.focus();
			},
			prefersReducedMotion() ? 0 : FADE_MS
		);
	}

	$effect(() => () => clearTimeout(fadeTimeoutId));
</script>

<svelte:head>
	<title>ThinkBreak Web Audio Builder</title>
	<meta
		name="description"
		content="Build portable synthesized Web Audio projects from MIDI compositions."
	/>
</svelte:head>

<div
	class="workspace"
	bind:this={workspaceElement}
	tabindex="-1"
	inert={landingMounted}
	aria-hidden={landingMounted ? 'true' : undefined}
>
	<ProjectBar />
	<ChannelSidebar />
	<MainPanel />
	<TransportBar />
</div>

{#if landingMounted}
	<LandingScreen fading={landingFading} onstart={handleStart} />
{/if}

<style>
	.workspace {
		display: grid;
		grid-template-rows: 40px minmax(0, 1fr) 48px;
		grid-template-columns: 260px minmax(0, 1fr);
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	/* Below the supported 1024px viewport the sidebar stacks above the main panel. */
	@media (max-width: 899px) {
		.workspace {
			grid-template-rows: 40px minmax(0, 180px) minmax(0, 1fr) 48px;
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
