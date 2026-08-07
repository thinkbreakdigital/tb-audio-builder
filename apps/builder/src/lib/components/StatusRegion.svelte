<script lang="ts">
	import { statusState } from '$lib/state/status.svelte.js';
</script>

<div class="status-region" aria-live="polite" role="status">
	{#if statusState.latestMessage}
		<span class="text">{statusState.latestMessage.text}</span>
		{#if statusState.latestMessage.detail}
			<span class="detail">{statusState.latestMessage.detail}</span>
		{/if}
	{/if}
</div>

<style>
	.status-region {
		display: flex;
		gap: var(--space-2);
		min-height: var(--control-height);
		align-items: center;
		padding: 0 var(--space-3);
		border-top: var(--border-width) solid var(--color-border);
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	.detail {
		color: var(--color-text-muted);
	}
</style>
