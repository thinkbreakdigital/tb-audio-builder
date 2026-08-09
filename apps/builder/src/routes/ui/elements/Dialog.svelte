<script lang="ts">
	let open = $state(false);
	let dialogEl = $state<HTMLDialogElement>();
	let triggerEl = $state<HTMLButtonElement>();

	function showDialog() {
		triggerEl?.focus();
		dialogEl?.showModal();
		open = true;
	}

	function closeDialog() {
		dialogEl?.close();
	}

	function handleClose() {
		open = false;
		triggerEl?.focus();
	}
</script>

<button bind:this={triggerEl} type="button" onclick={showDialog}>Open dialog</button>

<dialog bind:this={dialogEl} class="dialog" onclose={handleClose} aria-labelledby="dialog-title">
	<header>
		<h2 id="dialog-title">Apply sound set</h2>
		<p>Changes are previewed before they are applied.</p>
	</header>
	<div class="dialog-body">
		<p>Assignments, unchanged channels, and discarded entries appear here.</p>
	</div>
	<footer>
		<button type="button" onclick={closeDialog}>Cancel</button>
		<button type="button" class="primary" onclick={closeDialog}>Apply</button>
	</footer>
</dialog>

<style>
	button {
		height: var(--control-height);
		padding: 0 var(--space-3);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
		transition: background-color 100ms;
	}
	button:hover {
		background: var(--color-surface-active);
	}
	button.primary {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-text);
	}
	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	.dialog {
		width: min(420px, calc(100vw - var(--space-4)));
		max-height: min(430px, calc(100vh - var(--space-4)));
		padding: 0;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
	}
	.dialog::backdrop {
		background: rgb(0 0 0 / 62%);
	}
	header,
	footer {
		padding: var(--space-3) var(--space-4);
	}
	header {
		border-bottom: var(--border-width) solid var(--color-border);
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		font-size: var(--font-size-lg);
	}
	header p,
	.dialog-body {
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}
	header p {
		margin-top: var(--space-1);
	}
	.dialog-body {
		max-height: 220px;
		overflow: auto;
		padding: var(--space-4);
	}
	footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		border-top: var(--border-width) solid var(--color-border);
	}
	@media (max-width: 640px) {
		.dialog {
			width: calc(100vw - var(--space-4));
		}
		header,
		footer {
			padding: var(--space-3);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
