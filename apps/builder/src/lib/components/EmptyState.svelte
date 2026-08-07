<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		message: string;
		children?: Snippet;
		class?: string;
	}

	let { message, children, class: className = '' }: Props = $props();
</script>

<div class="empty-state {className}">
	<p>{message}</p>
	{#if children}
		<div class="empty-state-actions">{@render children()}</div>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-5);
		color: var(--color-text-muted);
		text-align: center;
	}

	.empty-state p {
		margin: 0;
	}

	.empty-state-actions {
		display: flex;
		gap: var(--space-2);
	}
</style>
