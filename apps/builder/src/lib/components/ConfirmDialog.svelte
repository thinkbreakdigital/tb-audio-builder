<script lang="ts">
	import Button from './Button.svelte';

	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel: string;
		onconfirm: () => void;
		class?: string;
	}

	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel,
		onconfirm,
		class: className = ''
	}: Props = $props();

	let dialogEl: HTMLDialogElement | undefined = $state();
	let triggerEl: Element | null = null;

	function close() {
		open = false;
	}

	function handleConfirm() {
		onconfirm();
		close();
	}

	function handleDialogClose() {
		open = false;
		if (triggerEl instanceof HTMLElement) {
			triggerEl.focus();
		}
		triggerEl = null;
	}

	$effect(() => {
		if (!dialogEl) return;
		if (open) {
			if (!dialogEl.open) {
				triggerEl = document.activeElement;
				dialogEl.showModal();
				dialogEl.querySelector<HTMLButtonElement>('.confirm-dialog-confirm')?.focus();
			}
		} else if (dialogEl.open) {
			dialogEl.close();
		}
	});
</script>

<dialog bind:this={dialogEl} class="confirm-dialog {className}" onclose={handleDialogClose}>
	<h2>{title}</h2>
	<p>{message}</p>
	<div class="actions">
		<Button type="button" onclick={close}>Cancel</Button>
		<Button type="button" variant="primary" class="confirm-dialog-confirm" onclick={handleConfirm}>
			{confirmLabel}
		</Button>
	</div>
</dialog>

<style>
	.confirm-dialog {
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		padding: var(--space-4);
		background: var(--color-background);
		color: var(--color-text);
		max-width: 420px;
	}

	.confirm-dialog h2 {
		margin: 0 0 var(--space-2) 0;
		font-size: var(--font-size-lg);
	}

	.confirm-dialog p {
		margin: 0 0 var(--space-4) 0;
		color: var(--color-text);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
