<script lang="ts">
	/** Compact labelled native checkbox specimen; state is local to the /ui catalog by default. */
	export interface Props {
		label?: string;
		checked?: boolean;
		align?: 'start' | 'center';
	}

	const uid = $props.id();
	const inputId = `${uid}-toggle`;
	let { label = 'Filter', checked = $bindable(false), align = 'start' }: Props = $props();
</script>

<label class="toggle-switch" class:centered={align === 'center'} for={inputId}>
	<span class="label">{label}</span>
	<span class="control">
		<input id={inputId} type="checkbox" bind:checked />
		<span class="track" aria-hidden="true"><span class="selector"></span></span>
		<span class="state-hint" role="tooltip">{checked ? 'Enabled' : 'Disabled'}</span>
	</span>
</label>

<style>
	.toggle-switch {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		color: var(--color-text);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.toggle-switch.centered {
		align-items: center;
	}

	.control {
		position: relative;
		display: inline-flex;
	}

	input {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.track {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		width: 28px;
		height: 14px;
		padding: 1px;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface-active);
	}

	.selector {
		width: 10px;
		height: 10px;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: 2px;
		background: var(--color-text-muted);
		transition:
			transform 100ms,
			background-color 100ms,
			border-color 100ms;
	}

	input:checked + .track {
		border-color: var(--color-accent);
	}

	input:checked + .track .selector {
		transform: translateX(14px);
		border-color: var(--color-accent-text);
		background: var(--color-accent);
	}

	.state-hint {
		position: absolute;
		left: calc(100% + var(--space-2));
		top: 50%;
		z-index: 1;
		visibility: hidden;
		padding: var(--space-1) var(--space-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		transform: translateY(-50%);
		white-space: nowrap;
	}

	.control:hover .state-hint,
	input:focus-visible ~ .state-hint {
		visibility: visible;
	}

	input:focus-visible + .track {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	/* Narrow viewport tightens spacing only — this stays a fine-pointer desktop control
	   (00-conventions.md §5 rules touch-target sizing out of scope), so the track/selector
	   dimensions never grow here. */
	@media (max-width: 640px) {
		.toggle-switch {
			gap: var(--space-1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.selector {
			transition: none;
		}
	}
</style>
