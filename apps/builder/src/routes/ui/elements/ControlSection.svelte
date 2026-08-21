<script lang="ts">
	import type { Snippet } from 'svelte';

	type Width = 'standard' | 'oscillator' | 'filter' | 'compact';

	interface Props {
		legend?: string;
		width?: Width;
		joined?: boolean;
		disabled?: boolean;
		children?: Snippet;
	}

	let {
		legend = 'Oscillator',
		width = 'standard',
		joined = false,
		disabled = false,
		children
	}: Props = $props();
</script>

<fieldset
	class="control-section"
	class:oscillator={width === 'oscillator'}
	class:filter={width === 'filter'}
	class:compact={width === 'compact'}
	class:joined
	class:disabled
>
	<legend>{legend}</legend>
	<div class="controls">
		{#if children}
			{@render children()}
		{:else}
			<div class="sample-control"><span>Wave</span><output>~</output></div>
			<div class="sample-control"><span>Level</span><output>0.80</output></div>
		{/if}
	</div>
</fieldset>

<style>
	.control-section {
		box-sizing: border-box;
		display: flex;
		flex: 0 0 var(--mod-7);
		flex-direction: column;
		gap: 0;
		width: var(--mod-7);
		min-width: 0;
		height: var(--band-4);
		margin: 0;
		padding: var(--pad-1) 0;
		border: var(--border-width) solid var(--color-border);
		border-radius: 0;
		background: var(--color-surface);
	}

	.control-section.oscillator {
		flex-basis: var(--mod-6);
		width: var(--mod-6);
	}

	.control-section.filter {
		flex-basis: calc(var(--mod-7) * 2);
		width: calc(var(--mod-7) * 2);
	}

	.control-section.compact {
		flex-basis: var(--mod-5);
		width: var(--mod-5);
	}

	.control-section.joined {
		padding-inline-start: var(--border-width);
		border-inline-start-width: 0;
	}

	.control-section.disabled {
		border-color: var(--color-border-strong);
		background: var(--color-background);
	}

	.control-section.disabled legend {
		color: var(--color-text-muted);
	}

	legend {
		box-sizing: border-box;
		min-height: var(--label-line);
		padding: 0 var(--pad-1);
		color: var(--color-text);
		font-size: var(--font-size-sm);
		font-weight: 700;
		line-height: var(--label-line);
	}

	.controls {
		display: flex;
		flex: 1;
		align-items: start;
		gap: 0;
		min-width: 0;
		min-height: 0;
	}

	.controls > :global(*) {
		min-width: 0;
	}

	.sample-control {
		box-sizing: border-box;
		display: grid;
		width: var(--mod-2);
		gap: var(--pad-1);
		padding: 0 var(--pad-2);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	output {
		min-width: 4ch;
		color: var(--color-text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
</style>
