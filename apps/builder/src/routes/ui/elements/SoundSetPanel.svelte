<script lang="ts">
	const soundSets = ['Warm Quartet', 'Drum Room'];
	let selectedName = $state(soundSets[0]);
	let message = $state('Choose a sound set to preview its assignments.');

	function save() {
		message = 'Sound set saved locally.';
	}
	function apply() {
		message = `${selectedName} is ready to apply after confirmation.`;
	}
	function remove() {
		message = `${selectedName} removed from this local specimen.`;
	}
</script>

<section class="sound-set-panel" aria-labelledby="sound-set-title">
	<h2 id="sound-set-title">Sound sets</h2>
	<p class="scope">
		Captures channel names, roles, enabled flags, instruments, mix, and master. It excludes MIDI,
		loop, tempo, export, sync, and workspace UI.
	</p>
	<label for="sound-set">Available sound set</label>
	<select id="sound-set" bind:value={selectedName}>
		{#each soundSets as soundSet (soundSet)}<option value={soundSet}>{soundSet}</option>{/each}
	</select>
	<div class="actions" aria-label="Sound set actions">
		<button type="button" onclick={save}>Save</button>
		<button type="button" class="primary" onclick={apply}>Apply</button>
		<button type="button" class="danger" onclick={remove}>Delete</button>
	</div>
	<p class="message" aria-live="polite">{message}</p>
</section>

<style>
	.sound-set-panel {
		width: min(var(--mod-9), 100%);
		padding: var(--pad-3);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		font-size: var(--font-size-base);
	}
	.scope {
		margin-top: var(--space-2);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		line-height: var(--line-height);
	}
	label {
		display: block;
		margin-top: var(--space-4);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}
	select {
		width: 100%;
		height: var(--control-height);
		margin-top: var(--space-1);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	button {
		height: var(--control-height);
		padding: 0 var(--pad-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
		transition: background-color 100ms;
	}
	button:hover {
		background: var(--color-surface-active);
	}
	button.primary {
		border-color: var(--color-accent);
		background: var(--color-accent);
		color: var(--color-accent-text);
	}
	button.danger {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}
	button:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	.message {
		min-height: calc(var(--font-size-sm) * var(--line-height));
		margin-top: var(--space-2);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}
	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
