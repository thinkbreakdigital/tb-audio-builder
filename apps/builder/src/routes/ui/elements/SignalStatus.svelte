<script lang="ts">
	/**
	 * Design specimen only — local state, zero wiring. See spec/implementation/00-conventions.md §5.2.
	 *
	 * The text line beneath LevelMeter that carries the real per-channel state (10B §4.3–4.4,
	 * conventions §6) — the meter is aria-hidden decoration, this is the source of truth. Every
	 * status is distinguishable in grayscale: color always ships alongside a different marker
	 * fill/border style and a different font weight, never color alone.
	 */
	export type SignalStatusValue = 'Audible' | 'Muted' | 'Silenced by solo' | 'Not included';

	export interface Props {
		status?: SignalStatusValue;
		/** Latched — stays true until resetClip fires, regardless of whether the signal is still hot. */
		clipped?: boolean;
	}

	let { status = 'Audible', clipped = $bindable(false) }: Props = $props();

	const STATUS_CLASS: Record<SignalStatusValue, string> = {
		Audible: 'status-audible',
		Muted: 'status-muted',
		'Silenced by solo': 'status-silenced',
		'Not included': 'status-not-included'
	};

	const statusClass = $derived(STATUS_CLASS[status]);

	function resetClip() {
		clipped = false;
	}
</script>

<div class="signal-status">
	<!-- STATUS LINE: fixed height + no wrap. The four phrases differ a lot in length ("Audible" vs
	     "Silenced by solo"), so height is reserved from font-size/line-height rather than content,
	     and text never wraps to a second line — that's what keeps the strip height constant as the
	     status changes. -->
	<p class="status-line {statusClass}">
		<span class="marker" aria-hidden="true"></span>
		{status}
	</p>

	<!-- CLIP ROW: always occupies its row height; only visibility toggles (the element never
	     unmounts), so a clip firing or clearing cannot shift anything below this component either. -->
	<p class="clip-line" class:is-visible={clipped}>
		<span class="clip-text">CLIP</span>
		<button type="button" class="clip-reset" onclick={resetClip} disabled={!clipped}>
			Reset
		</button>
	</p>
</div>

<style>
	.signal-status {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-family: var(--font-sans);
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	.status-line {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		height: calc(var(--font-size-sm) * var(--line-height));
		line-height: var(--line-height);
		white-space: nowrap;
	}

	.marker {
		box-sizing: border-box;
		flex: 0 0 auto;
		width: var(--space-2);
		height: var(--space-2);
		border: var(--border-width) solid var(--color-border-strong);
	}

	/* Audible: filled marker, bold text, success color. */
	.status-audible {
		font-weight: 700;
		color: var(--color-success);
	}
	.status-audible .marker {
		border-color: var(--color-success);
		background: var(--color-success);
	}

	/* Muted: hollow marker (solid border, no fill), struck-through text — readable in grayscale
	   from the strikethrough and border alone, without relying on the muted color. */
	.status-muted {
		font-weight: 400;
		color: var(--color-text-muted);
		text-decoration: line-through;
	}
	.status-muted .marker {
		border-style: solid;
		border-color: var(--color-text-muted);
		background: transparent;
	}

	/* Silenced by solo: dashed marker border, italic text — a third distinct grayscale treatment. */
	.status-silenced {
		font-weight: 400;
		font-style: italic;
		color: var(--color-warning);
	}
	.status-silenced .marker {
		border-style: dashed;
		border-color: var(--color-warning);
		background: transparent;
	}

	/* Not included: dotted marker border, lighter weight — reads as excluded even without color. */
	.status-not-included {
		font-weight: 300;
		color: var(--color-text-muted);
	}
	.status-not-included .marker {
		border-style: dotted;
		background: transparent;
	}

	.clip-line {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		height: var(--control-height);
		visibility: hidden;
	}

	.clip-line.is-visible {
		visibility: visible;
	}

	.clip-text {
		padding: 0 var(--space-1);
		border: var(--border-width) solid var(--color-danger);
		border-radius: var(--radius);
		color: var(--color-danger);
		font-weight: 700;
	}

	.clip-reset {
		height: var(--control-height);
		padding: 0 var(--space-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: var(--font-size-sm);
		transition:
			background-color 100ms,
			border-color 100ms;
	}

	.clip-reset:hover {
		background: var(--color-surface-active);
	}

	.clip-reset:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	@media (prefers-reduced-motion: reduce) {
		.clip-reset {
			transition: none;
		}
	}
</style>
