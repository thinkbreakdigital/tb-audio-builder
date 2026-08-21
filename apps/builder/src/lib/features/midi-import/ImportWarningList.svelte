<script lang="ts">
	import { importWarningsState } from './import-warnings.svelte.js';

	const count = $derived(importWarningsState.warnings.length);
	const summaryText = $derived(`${count} import warning${count === 1 ? '' : 's'}`);
</script>

{#if count > 0}
	<details class="warnings">
		<summary>{summaryText}</summary>
		<table>
			<thead>
				<tr>
					<th scope="col">Track</th>
					<th scope="col">Event</th>
					<th scope="col">Tick</th>
					<th scope="col">Message</th>
					<th scope="col">Suggested action</th>
				</tr>
			</thead>
			<tbody>
				{#each importWarningsState.warnings as warning, index (index)}
					<tr>
						<td>{warning.trackName}</td>
						<td>{warning.eventType}</td>
						<td>{warning.tick}</td>
						<td class="message">Warning: {warning.message}</td>
						<td>{warning.suggestedAction ?? '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</details>
{/if}

<style>
	.warnings {
		margin-top: var(--space-4);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	summary {
		padding: var(--space-2) var(--space-4);
		font-weight: 600;
		cursor: pointer;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		border-top: var(--border-width) solid var(--color-border);
		font-size: var(--font-size-sm);
	}

	th,
	td {
		padding: var(--space-1) var(--space-2);
		border-bottom: var(--border-width) solid var(--color-border);
		text-align: left;
		vertical-align: top;
	}

	th {
		color: var(--color-text-muted);
		font-weight: 600;
	}

	.message {
		color: var(--color-warning);
	}
</style>
