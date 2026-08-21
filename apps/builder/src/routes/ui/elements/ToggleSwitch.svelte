<script lang="ts">
	/**
	 * Compact labelled native checkbox specimen; state is local to the /ui catalog by default.
	 *
	 * Modular footprint (00-conventions.md §5.4): 64x64 (--mod-2 x --band-2). Three stacked rows —
	 * label (16), the switch band (32), and a reserved row for the enabled/disabled hint (16) — sum
	 * to the full 64px height with zero gap between them. The switch band is itself
	 * padding 8 + the 16px track + padding 8 vertically, and padding 16 + the 32px track + padding
	 * 16 horizontally, both from the padding scale (--pad-2, --pad-3). The hint row used to float as
	 * an absolutely positioned tooltip beside the control; it is now an ordinary in-flow row so its
	 * reveal on hover/focus never changes the module's footprint (§5.4: "A validation message MUST
	 * NOT change a module's footprint" applies here too, even though this is a hint, not an error).
	 */
	export interface Props {
		label?: string;
		checked?: boolean;
	}

	const uid = $props.id();
	const inputId = `${uid}-toggle`;
	let { label = 'Filter', checked = $bindable(false) }: Props = $props();
</script>

<label class="toggle-switch" for={inputId}>
	<span class="label">{label}</span>
	<span class="control">
		<input id={inputId} type="checkbox" bind:checked />
		<span class="track" aria-hidden="true"><span class="selector"></span></span>
	</span>
	<span class="state-hint" role="tooltip">{checked ? 'Enabled' : 'Disabled'}</span>
</label>

<style>
	.toggle-switch {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0;
		width: var(--mod-2);
		height: var(--band-2);
		padding: 0;
		color: var(--color-text);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.label {
		box-sizing: border-box;
		height: var(--label-line);
		overflow: hidden;
		line-height: var(--label-line);
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* The 32px band: padding 8 (--pad-2) top/bottom around the 16px track, padding 16 (--pad-3)
	   left/right around the 32px track — both baked into this element, not added by a parent. */
	.control {
		box-sizing: border-box;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		height: var(--band-1);
		padding: var(--pad-2) var(--pad-3);
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
		width: var(--mod-1);
		height: 16px;
		padding: 2px;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface-active);
	}

	.selector {
		width: 12px;
		height: 12px;
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
		/* 32 (track) - 2 x 2 (padding) - 12 (selector) = 16 available travel. */
		transform: translateX(16px);
		border-color: var(--color-accent-text);
		background: var(--color-accent);
	}

	.state-hint {
		box-sizing: border-box;
		height: var(--label-line);
		overflow: hidden;
		visibility: hidden;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		line-height: var(--label-line);
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.control:hover ~ .state-hint,
	.control:has(input:focus-visible) ~ .state-hint {
		visibility: visible;
	}

	input:focus-visible + .track {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	@media (prefers-reduced-motion: reduce) {
		.selector {
			transition: none;
		}
	}
</style>
