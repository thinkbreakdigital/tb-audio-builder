<script lang="ts">
	/** Button treatments only; actions intentionally stay local to the catalog. */
	let lastAction = $state('No action selected');
</script>

<div class="momentary-button" aria-label="Momentary button treatments">
	<div class="actions">
		<button type="button" onclick={() => (lastAction = 'Browse selected')}>Browse</button>
		<button type="button" class="primary" onclick={() => (lastAction = 'Apply selected')}
			>Apply</button
		>
		<button type="button" class="danger" onclick={() => (lastAction = 'Reset selected')}
			>Reset</button
		>
		<button type="button" disabled>Stop</button>
	</div>
	<p aria-live="polite">{lastAction}</p>
</div>

<style>
	.momentary-button {
		display: grid;
		gap: var(--space-2);
		font-size: var(--font-size-sm);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	button {
		height: var(--control-height);
		padding: 0 var(--space-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 100ms,
			border-color 100ms,
			color 100ms;
	}

	button:hover:not(:disabled) {
		background: var(--color-surface);
	}

	button.primary {
		border-color: var(--color-accent);
		background: var(--color-accent);
		color: var(--color-accent-text);
	}

	button.primary:hover {
		background: var(--color-surface-active);
		color: var(--color-text);
	}

	button.danger {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	button.danger:hover {
		background: var(--color-danger);
		color: var(--color-accent-text);
	}

	button:disabled {
		border-color: var(--color-border);
		color: var(--color-text-muted);
		cursor: not-allowed;
		opacity: 0.65;
	}

	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	p {
		margin: 0;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}

	@media (max-width: 640px) {
		button {
			min-height: 36px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
