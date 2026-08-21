<script lang="ts">
	type Patch = { name: string; source: 'Factory' | 'User' };

	const patches: readonly Patch[] = [
		{ name: 'Square Lead', source: 'Factory' },
		{ name: 'Filtered Drone', source: 'Factory' },
		{ name: 'Velvet Bass', source: 'User' }
	];
	let query = $state('');
	let selectedName = $state('Square Lead');
	let appliedName = $state('');
	let filteredPatches = $derived(
		patches.filter((patch) => patch.name.toLowerCase().includes(query.trim().toLowerCase()))
	);
</script>

<section class="patch-browser" aria-labelledby="patch-browser-title">
	<div class="heading">
		<h2 id="patch-browser-title">Patches</h2>
		<input bind:value={query} aria-label="Search patches" placeholder="Search" />
	</div>
	<div class="patch-list" aria-label="Patch results">
		{#each ['Factory', 'User'] as source (source)}
			{@const group = filteredPatches.filter((patch) => patch.source === source)}
			{#if group.length > 0}
				<section class="patch-group" aria-labelledby={`${source}-patches`}>
					<h3 id={`${source}-patches`}>{source}</h3>
					{#each group as patch (patch.name)}
						<button
							type="button"
							class:selected={selectedName === patch.name}
							aria-pressed={selectedName === patch.name}
							onclick={() => (selectedName = patch.name)}
						>
							<span>{patch.name}</span>
							{#if patch.source === 'Factory'}<small>Read-only</small>{/if}
						</button>
					{/each}
				</section>
			{/if}
		{/each}
		{#if filteredPatches.length === 0}<p class="no-results">No matching patches.</p>{/if}
	</div>
	<div class="actions">
		<span>{appliedName ? `${appliedName} applied` : 'Select a patch to audition.'}</span>
		<button type="button" class="apply" onclick={() => (appliedName = selectedName)}>Apply</button>
	</div>
</section>

<style>
	.patch-browser {
		width: min(var(--mod-9), 100%);
		border: var(--border-width) solid var(--color-border-strong);
		background: var(--color-background);
		color: var(--color-text);
	}
	.heading {
		display: grid;
		grid-template-columns: 1fr var(--mod-3);
		align-items: center;
		gap: var(--space-2);
		padding: var(--pad-2);
		border-bottom: var(--border-width) solid var(--color-border);
	}
	h2,
	h3,
	p {
		margin: 0;
	}
	h2 {
		font-size: var(--font-size-base);
	}
	input {
		box-sizing: border-box;
		width: 100%;
		height: var(--control-height);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
	}
	input:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}
	.patch-list {
		max-height: var(--band-5);
		overflow: auto;
	}
	.patch-group {
		padding: var(--pad-2);
		border-bottom: var(--border-width) solid var(--color-border);
	}
	h3 {
		margin-bottom: var(--space-1);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		font-weight: 400;
	}
	.patch-group button {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		min-height: var(--control-height);
		padding: 0 var(--pad-2);
		border: var(--border-width) solid transparent;
		border-radius: var(--radius);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		text-align: left;
		cursor: pointer;
		transition:
			background-color 100ms,
			border-color 100ms;
	}
	.patch-group button:hover {
		background: var(--color-surface);
	}
	.patch-group button.selected {
		border-color: var(--color-accent);
		background: var(--color-surface-active);
		font-weight: 700;
	}
	small {
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}
	.no-results {
		padding: var(--pad-2);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}
	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--pad-2);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}
	.apply {
		height: var(--control-height);
		padding: 0 var(--pad-2);
		border: var(--border-width) solid var(--color-accent);
		border-radius: var(--radius);
		background: var(--color-accent);
		color: var(--color-accent-text);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
	}
	@media (prefers-reduced-motion: reduce) {
		.patch-group button {
			transition: none;
		}
	}
</style>
