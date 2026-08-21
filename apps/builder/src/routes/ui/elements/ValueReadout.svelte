<script lang="ts">
	/**
	 * Design specimen only — local state, zero wiring. See spec/implementation/00-conventions.md §5.2.
	 *
	 * The one mono-font numeric readout used everywhere a resolved value is shown (10B §4.1–4.2,
	 * conventions §5.2, §6): parameter value + unit, MIDI note, pan, transport time, effective tempo,
	 * and resolved loop ticks. Same markup and type treatment in every case — only `format` and the
	 * matching data props change which string gets built.
	 */
	export type ValueReadoutFormat = 'value' | 'note' | 'pan' | 'time' | 'tempo' | 'ticks';

	export interface Props {
		format?: ValueReadoutFormat;
		size?: 'normal' | 'large';
		/** format: 'value' */
		value?: number;
		unit?: string;
		/** format: 'note' — MIDI note number, e.g. 60 */
		note?: number;
		/** format: 'pan' — -100 (full left) .. 100 (full right), 0 = center */
		pan?: number;
		/** format: 'time' */
		positionSeconds?: number;
		durationSeconds?: number;
		/** format: 'tempo' */
		bpm?: number;
		/** format: 'ticks' */
		startTicks?: number;
		endTicks?: number;
		clickable?: boolean;
		clipped?: boolean;
		ariaLabel?: string;
		onclick?: (event: MouseEvent) => void;
	}

	let {
		format = 'value',
		size = 'normal',
		value = 1.2,
		unit = 'kHz',
		note = 60,
		pan = 0,
		positionSeconds = 64.25,
		durationSeconds = 192,
		bpm = 124,
		startTicks = 1920,
		endTicks = 7680,
		clickable = false,
		clipped = false,
		ariaLabel,
		onclick
	}: Props = $props();

	const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

	function formatNote(midi: number): string {
		const octave = Math.floor(midi / 12) - 1;
		const name = NOTE_NAMES[((midi % 12) + 12) % 12];
		return `${name}${octave} (${midi})`;
	}

	function formatPan(amount: number): string {
		if (amount === 0) return 'C';
		return amount < 0 ? `L${Math.abs(amount)}` : `R${amount}`;
	}

	// Shared with ScrubSlider's transport time formatting (m:ss.mmm) — this is the readout that
	// same value ultimately renders through, kept local here per the self-contained specimen rule.
	function formatClock(totalSeconds: number): string {
		let ms = Math.round(Math.max(0, totalSeconds) * 1000);
		const minutes = Math.floor(ms / 60000);
		ms -= minutes * 60000;
		const seconds = Math.floor(ms / 1000);
		const millis = ms - seconds * 1000;
		return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
	}

	const text = $derived.by(() => {
		switch (format) {
			case 'note':
				return formatNote(note);
			case 'pan':
				return formatPan(pan);
			case 'time':
				return `${formatClock(positionSeconds)} / ${formatClock(durationSeconds)}`;
			case 'tempo':
				return `${bpm.toFixed(1)} BPM`;
			case 'ticks':
				return `${startTicks} – ${endTicks}`;
			case 'value':
			default:
				return `${value} ${unit}`;
		}
	});
</script>

{#if clickable}
	<button
		type="button"
		class="readout boxed format-{format}"
		class:large={size === 'large'}
		class:clipped
		aria-label={ariaLabel ?? text}
		{onclick}
	>
		{text}{#if clipped}<span aria-hidden="true"> !</span>{/if}
	</button>
{:else}
	<span class="readout format-{format}" class:large={size === 'large'}>{text}</span>
{/if}

<style>
	.readout {
		display: inline-block;
		box-sizing: border-box;
		/* One band tall regardless of format (00-conventions.md §5.4). */
		height: var(--band-1);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: var(--font-size-base);
		line-height: var(--band-1);
		text-align: right;
		/* Locks per-glyph width so a change like 9 -> 10, or 64.250 -> 104.250, never reflows
		   neighboring controls — only the digits change, the box does not. */
		font-variant-numeric: tabular-nums;
	}

	.readout.large {
		font-size: var(--font-size-lg);
		font-weight: 700;
	}

	.boxed {
		padding: 0 var(--space-1);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		cursor: pointer;
	}

	.boxed:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.boxed.clipped {
		border-color: var(--color-danger);
		background: var(--color-danger);
		color: var(--color-accent-text);
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	/* Per-format width: fixed module footprint, not a min-width, so the readout's own box stays put
	   as digits change within it (00-conventions.md §5.4). Reserves space for the longest realistic
	   string in that format: value (7ch) and pan (5ch) fit --mod-2 (64px); note (9ch), tempo (9ch),
	   and ticks (13ch) fit --mod-3 (96px); time (19ch, "m:ss.mmm / m:ss.mmm") fits --mod-5 (160px). */
	.format-value {
		width: var(--mod-2);
	}

	.format-note {
		width: var(--mod-3);
	}

	.format-pan {
		width: var(--mod-2);
	}

	.format-time {
		width: var(--mod-5);
	}

	.format-tempo {
		width: var(--mod-3);
	}

	.format-ticks {
		width: var(--mod-3);
	}
</style>
