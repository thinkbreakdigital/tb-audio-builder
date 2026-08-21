<script lang="ts">
	/**
	 * Design specimen only — local state, zero wiring. See spec/implementation/00-conventions.md §5.2
	 * and §5.4, and spec/implementation/09b-instrument-editor-ui.md §4.3.
	 *
	 * The compact toggle that selects which parameter a shared knob is editing (a "bank" selector in
	 * 09B vocabulary). One component serves two vocabularies, derived from `segments.length` rather
	 * than a mode flag:
	 *
	 *   - 2 segments → full-word cells inside the track, e.g. Mono/Poly voice mode:
	 *       <SegmentSwitch
	 *         legend="Voice mode"
	 *         segments={[
	 *           { value: 'mono', initial: 'MONO', label: 'Mono' },
	 *           { value: 'poly', initial: 'POLY', label: 'Poly' }
	 *         ]}
	 *       />
	 *   - 3 segments (the default, `<SegmentSwitch />` with no props) → compact initials printed
	 *     INSIDE the track, BOSS-pedal-MODE-switch style: each third of the track is one initial and
	 *     is itself the full click target (edge to edge, no separate label row), the thumb slides
	 *     behind the text, and the active segment's full name stays visible as text beneath, with
	 *     every initial carrying a full accessible name plus hover/focus help. This is the O/S/F pitch
	 *     bank (Octave / Semitone / Fine tune).
	 *
	 * Both vocabularies render through the same inside-track markup below; the only difference is
	 * which width token a segment cell uses. Design-review change (§5.4): the earlier build gave the
	 * 2-segment case its own layout, with full-word labels flanking the track as separate elements.
	 * That could not be made to land on a module footprint — the flanking labels have no fixed width
	 * to budget for, so the surrounding module could never declare an exact border-box size. Moving
	 * the words inside the track, at `--segment-width-word` (40px) instead of the initials'
	 * `--segment-width` (16px), gives the 2-segment case the same "N cells + one border, centred by
	 * padding" arithmetic as the 3- and 4-segment cases, so all three land on a modular width without
	 * the caller doing arithmetic (see `moduleWidth` below). "MONO"/"POLY" already read as full words
	 * at that cell width, so there is no abbreviation to explain — the per-segment help tooltip is
	 * harmless there but does no work, exactly as it would be redundant on an already-full-name label.
	 *
	 * Visual basis: thinkbreakfrontpage's TwoWayToggle.vue (flanking labels, hidden real input, a
	 * track element, an absolutely positioned sliding thumb). Required departures from that file, per
	 * the design brief:
	 *
	 *   1. A named native radio group in a <fieldset>/<legend>, one <input type="radio"> per segment
	 *      with its own real <label>, instead of one checkbox — a checkbox cannot express a third
	 *      position or give per-option accessible names (09B §4.3).
	 *   2. Rectangular geometry (`--radius: 3px`) instead of the Vue file's pill
	 *      (border-radius: 999px), and no box-shadow on the thumb — both prohibited by conventions §5.
	 *   3. Tokens only: `--color-text-muted` for the inactive label instead of the Vue file's
	 *      `color-mix(in srgb, var(--tb-color-text) 52%, transparent)`. No raw color literals anywhere.
	 *
	 * Motion note: conventions §5 caps transitions to background-color/border-color/color/opacity at
	 * 100ms. 09B §4.3 explicitly authorizes this toggle family's sliding indicator as the one named
	 * exception, and reduced motion still must make it instant. The thumb's `transform` transition is
	 * kept at 100ms (capped — the Vue file used 180ms) and removed entirely under
	 * prefers-reduced-motion, same as every other timed effect in this catalog.
	 *
	 * Selection is local $state only (via $bindable so the /ui page can wire nothing at all and it
	 * still renders correctly). Per 09B §4.3, changing which segment is active only swaps which
	 * spec/value the *shared* knob would edit next to it — it performs zero audio, project, autosave,
	 * or sync work. There is nothing to wire here even in the real feature, which is why this
	 * component never imports engine/project/state modules.
	 *
	 * Extending to a fourth position (e.g. an A/D/S/R bank): the markup below is already N-agnostic —
	 * one declared segment-cell width sizes the switch (`width * count`), every segment
	 * (`flex: 0 0 var(--segment-width)`), and the thumb, whose offset is
	 * `translateX(index * var(--segment-width))`. Nothing resolves a percentage against a box it does
	 * not share, so a fourth position needs no extra math — `moduleWidth` below rounds the resulting
	 * track up to the next 32px module on its own.
	 */
	export interface Segment {
		/** Stable identity for the option, e.g. 'octave'. */
		value: string;
		/** Compact visible text — the full word for a 2-segment switch, one initial for 3 or 4. */
		initial: string;
		/** Full name: the accessible name for an initial cell and the always-visible active name. */
		label: string;
	}

	export interface Props {
		/** Fieldset legend — the group's accessible name. */
		legend?: string;
		/** 2, 3, or 4 segments. Cell width (initial vs word) is derived from the length, not a prop. */
		segments?: Segment[];
		/** Selected segment's `value`. Local-only; defaults to the first segment. */
		selected?: string;
	}

	const DEFAULT_SEGMENTS: Segment[] = [
		{ value: 'octave', initial: 'O', label: 'Octave' },
		{ value: 'semitone', initial: 'S', label: 'Semitone' },
		{ value: 'fine', initial: 'F', label: 'Fine tune' }
	];

	let {
		legend = 'Pitch bank',
		segments = DEFAULT_SEGMENTS,
		selected = $bindable(segments[0]?.value ?? '')
	}: Props = $props();

	const uid = $props.id();
	const groupName = `${uid}-segment`;

	const selectedIndex = $derived(
		Math.max(
			0,
			segments.findIndex((segment) => segment.value === selected)
		)
	);
	const activeSegment = $derived(segments[selectedIndex]);
	const isWordVariant = $derived(segments.length === 2);

	// Mirrors tokens.css --segment-width (16px), --segment-width-word (40px), and --border-width
	// (1px): the module's own footprint (width + inline padding) has to be resolved here, in the
	// same render pass that decides the segment count, not in a follow-up pass over a measured DOM
	// node. Rounding a track up to the next 32px grid module has no calc()-only equivalent, so the
	// arithmetic lives in script instead of CSS. See 00-conventions.md §5.4: a module's declared
	// width MUST include its own border and padding, and the parts MUST sum to the footprint exactly.
	const SEGMENT_WIDTH_INITIAL_PX = 16;
	const SEGMENT_WIDTH_WORD_PX = 40;
	const TRACK_BORDER_PX = 2; // one 1px border on each side of the content-box track, once per track
	const GRID_MODULE_PX = 32;

	const trackWidth = $derived(
		segments.length * (isWordVariant ? SEGMENT_WIDTH_WORD_PX : SEGMENT_WIDTH_INITIAL_PX) +
			TRACK_BORDER_PX
	);
	// The next 32px module at or above the drawn track: 3 initials -> 64, 4 initials -> 96,
	// 2 words -> 96. The surrounding module absorbs the leftover, including the track's 2px border
	// overhang, as inline padding split evenly across both sides.
	const moduleWidth = $derived(Math.ceil(trackWidth / GRID_MODULE_PX) * GRID_MODULE_PX);
	const trackPadX = $derived((moduleWidth - trackWidth) / 2);

	function idFor(index: number): string {
		return `${uid}-segment-${index}`;
	}

	function thumbTransform(): string {
		// Offset in explicit --segment-width units, not percentages. A percentage would resolve
		// against the thumb's own width, which is only correct while the thumb, the segments, and the
		// visible track all share one box — they did not, and the thumb ended up wider than the
		// segment it selects. One declared width now drives all three.
		return `transform: translateX(calc(${selectedIndex} * var(--segment-width)));`;
	}
</script>

<fieldset class="segment-switch" style={`width: ${moduleWidth}px; padding-inline: ${trackPadX}px;`}>
	<legend class="legend">{legend}</legend>

	<div class="track-band">
		<!-- Not aria-hidden here: this element directly contains the real radio inputs and labels —
		     they're the click targets, not a separate row elsewhere. -->
		<span class="switch" class:word={isWordVariant} style={`--segment-count: ${segments.length};`}>
			<span class="thumb" style={thumbTransform()} aria-hidden="true"></span>

			{#each segments as segment, index (segment.value)}
				<input
					class="sr-only"
					type="radio"
					id={idFor(index)}
					name={groupName}
					value={segment.value}
					bind:group={selected}
					aria-label={segment.label}
				/>
				<label class="segment-label" class:active={selectedIndex === index} for={idFor(index)}>
					{segment.initial}
					<span class="help" aria-hidden="true">{segment.label}</span>
				</label>
			{/each}
		</span>
	</div>

	<!-- 09B §4.3: the active option's full name must stay visible, not just on hover. -->
	<p class="active-name">{activeSegment?.label}</p>
</fieldset>

<style>
	.segment-switch {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0;
		height: var(--band-2);
		margin: 0;
		border: 0;
		padding-block: 0;
		font-family: var(--font-sans);
	}

	.legend {
		box-sizing: border-box;
		height: var(--label-line);
		overflow: hidden;
		padding: 0;
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		line-height: var(--label-line);
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* The 32px band: pad-1 (4px) + the 24px track + pad-1 (4px). */
	.track-band {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		height: var(--band-1);
		padding-block: var(--pad-1);
	}

	/* Design-review change: the segment initials/words live INSIDE the track — each is a full cell
	   of it, edge to edge, and is itself the click target (see the fieldset markup above), not a
	   separate row or a flanking label beside it. */
	.segment-label {
		position: relative;
		z-index: 1;
		display: flex;
		/* Declared, not derived: each segment is exactly one --segment-width, the identical value the
		   thumb uses. flex: 1 1 0 asked the browser to divide the container instead, which only
		   agreed with the thumb while both measured the same box. min-width: 0 stays because a flex
		   item defaults to min-width: auto and would otherwise refuse to shrink to the declared
		   width if its content were ever wider. */
		flex: 0 0 var(--segment-width);
		min-width: 0;
		align-items: center;
		justify-content: center;
		height: 100%;
		/* All segments share this color, not just the inactive ones — see the .active rule below for
		   why. */
		color: var(--color-text);
		font-size: var(--font-size-sm);
		font-weight: 400;
		line-height: 1;
		cursor: pointer;
		user-select: none;
	}

	/* Design-review correction: inactive segments are NOT dimmed — every segment stays --color-text so
	   the only thing that moves is the thumb underneath. The selected one flips to --color-accent-text
	   purely because the thumb (--color-accent) has slid under it and needs contrast against that fill
	   (~6.8:1, checked, comfortably past the 4.5:1 AA floor at this font size) — that reads as the
	   thumb passing beneath the text rather than the other segments going inert. State is still never
	   color-only: the active segment also goes bold, per conventions §5's weight/fill/border/text
	   requirement. */
	.segment-label.active {
		color: var(--color-accent-text);
		font-weight: 700;
	}

	.active-name {
		box-sizing: border-box;
		height: var(--readout-line);
		overflow: hidden;
		margin: 0;
		color: var(--color-text);
		font-size: var(--font-size-sm);
		line-height: var(--readout-line);
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* A 24px track centred in one 32px band, per 00-conventions.md §5.4, which supersedes 09B §4.3's
	   "about 1.25rem". One declared segment width drives the switch width, every segment, and the
	   thumb — --segment-width (16px) for initial cells, --segment-width-word (40px) for word cells
	   via .switch.word below. The border lives on .switch with box-sizing: content-box, so it sits
	   OUTSIDE the content box — which means the content box, the flex segments, and the absolutely
	   positioned thumb's containing block are all the same rectangle. Previously the border belonged
	   to an inset .track, so the visible strip was 2px narrower than the box the segments and thumb
	   were measured against and the thumb read as wider than the segment under it. The height is content
	   height, not the rendered 24px: content-box height + a 1px border top and bottom must sum to
	   --segment-height (24px), so the content value is --segment-height minus two border widths. */
	.switch {
		position: relative;
		box-sizing: content-box;
		display: flex;
		width: calc(var(--segment-width) * var(--segment-count));
		height: calc(var(--segment-height) - 2 * var(--border-width));
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		flex: 0 0 auto;
	}

	.switch.word {
		--segment-width: var(--segment-width-word);
	}

	/* Design-review fix: the thumb used to live inside a `.travel` wrapper inset 2px from `.switch`,
	   sizing/translating itself against that 4px-narrower box while `.segment-label` sized itself
	   against `.switch` directly — two different boxes gave two different "thirds" and the outer
	   stops drifted ~1.3px off the real segment centers. The thumb is a direct child of `.switch`,
	   the same box the segment labels flex against, so `width` and `translateX` both resolve against
	   the identical value the segments do. */
	.thumb {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		box-sizing: border-box;
		width: var(--segment-width);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-accent);
		pointer-events: none;
		/* 09B §4.3 names this toggle family's slide as the one authorized exception to conventions
		   §5's background-color/border-color/color/opacity-only transition list; still capped at
		   100ms and killed below under reduced motion. */
		transition: transform 100ms;
	}

	input:focus-visible + .segment-label {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.help {
		position: absolute;
		bottom: calc(100% + var(--pad-1));
		left: 50%;
		z-index: 2;
		transform: translateX(-50%);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		padding: 2px var(--pad-1);
		color: var(--color-text);
		font-size: var(--font-size-sm);
		line-height: 1.4;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 100ms;
	}

	.segment-label:hover .help,
	input:focus-visible + .segment-label .help {
		opacity: 1;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		border: 0;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	@media (prefers-reduced-motion: reduce) {
		.thumb,
		.help {
			transition: none;
		}
	}
</style>
