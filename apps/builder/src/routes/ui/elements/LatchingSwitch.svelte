<script lang="ts">
	/**
	 * Local-only mixer latch specimen; pressed styles retain fill, border-color, and weight changes.
	 *
	 * Modular footprint (00-conventions.md §5.4): 64x32 (--mod-2 x --band-1). The Solo and Mute
	 * buttons are 32x32 (var(--control-height) both axes) and butt together at gap: 0, so
	 * 32 + 32 = 64. Mute, the second button in the run, sets border-inline-start-width: 0 and adds
	 * that 1px to its inline-start padding so the shared edge reads as one 1px border rather than a
	 * doubled 2px line, per §5.4's butted-seam rule.
	 */
	export interface Props {
		solo?: boolean;
		mute?: boolean;
		label?: string;
	}

	let {
		solo = $bindable(false),
		mute = $bindable(false),
		label = 'Channel latches'
	}: Props = $props();
</script>

<div class="latching-switch" role="group" aria-label={label}>
	<button
		type="button"
		class:pressed={solo}
		class:solo
		aria-pressed={solo}
		onclick={() => (solo = !solo)}
	>
		S<span class="sr-only">olo</span>
	</button>
	<button
		type="button"
		class:pressed={mute}
		class:mute
		aria-pressed={mute}
		onclick={() => (mute = !mute)}
	>
		M<span class="sr-only">ute</span>
	</button>
</div>

<style>
	.latching-switch {
		box-sizing: border-box;
		display: inline-flex;
		gap: 0;
		width: var(--mod-2);
		height: var(--band-1);
	}
	button {
		box-sizing: border-box;
		width: var(--control-height);
		height: var(--control-height);
		padding: var(--pad-1);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: 0;
		background: var(--color-background);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		font-weight: 400;
		cursor: pointer;
		transition:
			background-color 100ms,
			border-color 100ms,
			color 100ms;
	}
	button:hover {
		background: var(--color-surface);
	}
	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}
	button.pressed {
		color: var(--color-accent-text);
		font-weight: 700;
		border-width: var(--border-width);
	}
	button.solo.pressed {
		background: var(--color-warning);
		border-color: var(--color-warning);
	}
	button.mute.pressed {
		background: var(--color-danger);
		border-color: var(--color-danger);
	}
	/* Run start: keeps its full border and the outer-left corner radius. */
	button.solo {
		border-start-start-radius: var(--radius);
		border-end-start-radius: var(--radius);
	}
	/* Butted seam (00-conventions.md §5.4): the second button drops its inline-start border and
	   adds that 1px to its inline-start padding — 32 (border 0+1, padding 5+4, content 22) matches
	   solo's 32 (border 1+1, padding 4+4, content 22), so the run still sums to exactly 64px and the
	   seam reads as one 1px line, not two. */
	button.mute {
		border-inline-start-width: 0;
		padding-inline-start: calc(var(--pad-1) + 1px);
		border-start-end-radius: var(--radius);
		border-end-end-radius: var(--radius);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}
	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
