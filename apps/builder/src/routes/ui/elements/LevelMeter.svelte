<script lang="ts">
	/**
	 * Design specimen only — local state, zero wiring. See spec/implementation/00-conventions.md §5.2.
	 *
	 * Supplemental per-channel/master level meter (10B §4.4). One flat bordered bar with a single
	 * solid fill — no gradient, canvas, segments, peak-hold animation, or color ramp from green to
	 * red. The meter is decoration only; SignalStatus is the real source of truth for channel state.
	 *
	 * aria-hidden: this is the one element in the app allowed to be invisible to assistive tech. The
	 * channel strip must read completely with this meter ignored — SignalStatus (a sibling text
	 * element) carries Audible / Muted / Silenced by solo / Not included plus the latched CLIP state.
	 *
	 * Timer-free by design: this component owns no setInterval/rAF loop. `level` is a plain prop the
	 * parent pushes in on every frame it cares to; in production a single layout-installed
	 * visibility/poller lifecycle (10B §4.7) drives every meter's `level` together, rather than each
	 * meter instance running its own timer.
	 */
	export interface Props {
		level?: number;
		orientation?: 'vertical' | 'horizontal';
	}

	let { level = 0, orientation = 'vertical' }: Props = $props();

	const fraction = $derived(Math.min(1, Math.max(0, level)));
</script>

<div class="meter" class:horizontal={orientation === 'horizontal'} aria-hidden="true">
	<div
		class="fill"
		style={orientation === 'horizontal'
			? `width: ${fraction * 100}%`
			: `height: ${fraction * 100}%`}
	></div>
</div>

<style>
	.meter {
		/* Specimen throw: 72px tall. Production channel strip meter runs the strip's available
		   height inside the compact column (10B §4.3), roughly 140px. */
		box-sizing: border-box;
		display: flex;
		align-items: flex-end;
		width: var(--space-3);
		height: 72px;
		overflow: hidden;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	.meter.horizontal {
		align-items: stretch;
		width: 72px;
		height: var(--space-3);
	}

	.fill {
		width: 100%;
		/* Single flat fill color — never a ramp or gradient across the level. */
		background: var(--color-accent);
	}

	.horizontal .fill {
		width: auto;
		height: 100%;
	}
</style>
