<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		children: Snippet;
		actions?: Snippet;
		class?: string;
	}

	let { title, children, actions, class: className = '' }: Props = $props();
</script>

<section class="panel {className}">
	<header class="panel-header">
		<h2>{title}</h2>
		{#if actions}
			<div class="panel-actions">{@render actions()}</div>
		{/if}
	</header>
	<div class="panel-body">
		{@render children()}
	</div>
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: var(--control-height);
		padding: 0 var(--pad-3);
		border-bottom: var(--border-width) solid var(--color-border);
	}

	.panel-header h2 {
		margin: 0;
		font-size: var(--font-size-base);
		font-weight: 600;
	}

	.panel-actions {
		display: flex;
		gap: var(--space-2);
	}

	.panel-body {
		padding: var(--pad-3);
	}
</style>
