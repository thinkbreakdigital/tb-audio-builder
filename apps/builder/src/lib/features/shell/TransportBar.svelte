<script lang="ts">
	import Button from '$lib/components/Button.svelte';

	// Phase 06 wires these to the audio runtime; until then the transport has nothing to drive.
	const TRANSPORT_ACTIONS = ['Play', 'Pause', 'Stop', 'Return to start'];
</script>

<footer class="transport-bar">
	{#each TRANSPORT_ACTIONS as action (action)}
		<Button disabled>{action}</Button>
	{/each}
	<span class="position">0:00.000 / 0:00.000</span>
</footer>

<style>
	.transport-bar {
		display: flex;
		grid-column: 1 / -1;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-4);
		border-top: var(--border-width) solid var(--color-border);
		background: var(--color-surface);
	}

	.position {
		margin-left: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}
</style>
