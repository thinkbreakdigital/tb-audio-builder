<script lang="ts">
	/**
	 * Design specimen only — local state, zero wiring. See spec/implementation/00-conventions.md §5.2.
	 *
	 * Supplemental per-channel/master level meter (10B §4.4). One flat bordered bar with stacked
	 * solid zones — no gradient, canvas, or peak-hold animation. Green always fills the level
	 * below −12 dB; only the portion above that cutoff becomes warning yellow, and only the portion
	 * above 0 dB becomes red. The meter is decoration only; the channel latches communicate channel
	 * state.
	 *
	 * aria-hidden: this is the one element in the app allowed to be invisible to assistive tech. The
	 * channel strip must read completely with this meter ignored — its controls carry the actual state.
	 *
	 * Timer-free by design: this component owns no setInterval/rAF loop. `levelDb` is a plain prop the
	 * parent pushes in on every frame it cares to; in production a single layout-installed
	 * visibility/poller lifecycle (10B §4.7) drives every meter's `level` together, rather than each
	 * meter instance running its own timer.
	 */
	export interface Props {
		/** Instantaneous signal level in decibels. */
		levelDb?: number;
		/** Lower edge of the visible dB scale. dB positions are linear; their amplitude equivalents are logarithmic. */
		minDb?: number;
		/** Upper edge reserves visible headroom for the red 0 dB-and-above zone. */
		maxDb?: number;
		/** Vertical throw in pixels; lets a strip match its adjacent fader. */
		height?: string;
		/** Show fixed dB milestones alongside a vertical meter. */
		showScale?: boolean;
		orientation?: 'vertical' | 'horizontal';
	}

	let {
		levelDb = -6,
		minDb = -48,
		maxDb = 6,
		height = '96px',
		showScale = false,
		orientation = 'vertical'
	}: Props = $props();

	const rangeDb = $derived(Math.max(1, maxDb - minDb));
	const clampFraction = (valueDb: number) => Math.min(1, Math.max(0, (valueDb - minDb) / rangeDb));
	const safeFraction = $derived(clampFraction(Math.min(levelDb, -12)));
	const warningFraction = $derived(Math.max(0, clampFraction(Math.min(levelDb, 0)) - safeFraction));
	const clippingFraction = $derived(
		Math.max(0, clampFraction(levelDb) - safeFraction - warningFraction)
	);

	function zoneStyle(fraction: number, offset: number): string {
		return orientation === 'horizontal'
			? `width: ${fraction * 100}%; left: ${offset * 100}%;`
			: `height: ${fraction * 100}%; bottom: ${offset * 100}%;`;
	}

	function scaleStyle(markDb: number): string {
		return `top: ${((maxDb - markDb) / rangeDb) * 100}%;`;
	}
</script>

<div
	class="meter-with-scale"
	class:horizontal={orientation === 'horizontal'}
	style={`--meter-length: ${height};`}
	aria-hidden="true"
>
	<div class="meter">
		<span class="zone safe" style={zoneStyle(safeFraction, 0)}></span>
		<span class="zone warning" style={zoneStyle(warningFraction, safeFraction)}></span>
		<span class="zone clipping" style={zoneStyle(clippingFraction, safeFraction + warningFraction)}
		></span>
	</div>
	{#if showScale && orientation === 'vertical'}
		<div class="scale">
			{#each [0, -6, -12, -24, -48] as markDb (markDb)}
				<span style={scaleStyle(markDb)}>{markDb}</span>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* Specimen footprint (vertical, scale shown): meter 16 + gap 16 + scale 32 = 64 wide
	   (--mod-2), bar 96 tall (--band-3, the default `height`) (00-conventions.md §5.4). */
	.meter-with-scale {
		display: flex;
		align-items: stretch;
		gap: var(--space-4);
		height: var(--meter-length);
	}

	.meter {
		/* The caller controls the throw so a strip can match its adjacent fader exactly. */
		box-sizing: border-box;
		position: relative;
		width: var(--meter-width);
		height: var(--meter-length);
		overflow: hidden;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	.meter-with-scale.horizontal {
		display: block;
	}

	.horizontal .meter {
		width: var(--meter-length);
		height: var(--meter-width);
	}

	.zone {
		position: absolute;
		left: 0;
		width: 100%;
	}

	.safe {
		background: var(--color-success);
	}

	.warning {
		background: var(--color-warning);
	}

	.clipping {
		background: var(--color-danger);
	}

	.horizontal .zone {
		height: 100%;
		bottom: 0;
	}

	.scale {
		position: relative;
		width: var(--meter-scale-width);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		line-height: 1;
		color: var(--color-text-muted);
	}

	.scale span {
		position: absolute;
		left: 0;
		transform: translateY(-50%);
	}

	.scale span:last-child {
		transform: translateY(-100%);
	}
</style>
