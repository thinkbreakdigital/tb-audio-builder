<script lang="ts">
	/**
	 * Design specimen only — local state, zero wiring. See spec/implementation/00-conventions.md §5.2
	 * and spec/implementation/09b-instrument-editor-ui.md §4.3.
	 *
	 * The compact toggle that selects which parameter a shared knob is editing (a "bank" selector in
	 * 09B vocabulary). One component serves two layouts, derived from `segments.length` rather than a
	 * mode flag:
	 *
	 *   - 2 segments → flanking full-word labels either side of the switch, e.g. Mono/Poly voice mode:
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
	 * Visual basis: thinkbreakfrontpage's TwoWayToggle.vue (flanking labels, hidden real input, a
	 * track element, an absolutely positioned sliding thumb). Three required departures from that
	 * file, per the design brief:
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
	 * Extending to a fourth position (e.g. an A/D/S/R bank): the three-position branch below is
	 * already N-agnostic — one declared `--segment-width` sizes the switch (`width * count`), every
	 * segment (`flex: 0 0 var(--segment-width)`), and the thumb, whose offset is
	 * `translateX(index * var(--segment-width))`. Nothing resolves a percentage against a box it does
	 * not share, so a fourth position needs no extra math. Only the
	 * two-position branch is hand-built for exactly two flanking labels; a fourth position always goes
	 * through the "three-position" (beneath-switch-initials) branch, so in practice only the
	 * `segments.length === 2` condition below would need broadening to `<= 2` / `> 2` if a 4-wide bank
	 * ever needs a distinct look, which it does not: it can reuse the three-position layout as-is.
	 */
	export interface Segment {
		/** Stable identity for the option, e.g. 'octave'. */
		value: string;
		/** Compact visible text — the full word for a 2-segment switch, one initial for 3. */
		initial: string;
		/** Full name: the accessible name for a 3-segment initial and the always-visible active name. */
		label: string;
	}

	export interface Props {
		/** Fieldset legend — the group's accessible name. */
		legend?: string;
		/** 2 or 3 segments. Layout is derived from the length, not a separate mode prop. */
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
	const isTwoPosition = $derived(segments.length === 2);

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

<fieldset class="segment-switch">
	<legend class="legend">{legend}</legend>

	{#if isTwoPosition}
		<div class="row" style={`--segment-count: ${segments.length};`}>
			<input
				class="sr-only"
				type="radio"
				id={idFor(0)}
				name={groupName}
				value={segments[0].value}
				bind:group={selected}
			/>
			<label class="flank" class:active={selectedIndex === 0} for={idFor(0)}>
				{segments[0].initial}
			</label>

			<span class="switch" aria-hidden="true">
				<span class="thumb" style={thumbTransform()}></span>
			</span>

			<input
				class="sr-only"
				type="radio"
				id={idFor(1)}
				name={groupName}
				value={segments[1].value}
				bind:group={selected}
			/>
			<label class="flank" class:active={selectedIndex === 1} for={idFor(1)}>
				{segments[1].initial}
			</label>
		</div>
	{:else}
		<div class="stack" style={`--segment-count: ${segments.length};`}>
			<!-- Not aria-hidden here: unlike the two-position switch, this one directly contains the
			     real radio inputs and labels — they're the click targets, not a separate row below. -->
			<span class="switch three">
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

			<!-- 09B §4.3: the active option's full name must stay visible, not just on hover. -->
			<p class="active-name">{activeSegment?.label}</p>
		</div>
	{/if}
</fieldset>

<style>
	.segment-switch {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		border: 0;
		padding: 0;
		font-family: var(--font-sans);
	}

	.legend {
		padding: 0;
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		text-align: center;
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.stack {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
	}

	.flank {
		position: relative;
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: none;
		text-underline-offset: 2px;
		cursor: pointer;
		user-select: none;
	}

	/* State is never color-only: the thumb's position already carries it, and the active flank label
	   also switches to full-strength text plus an underline. */
	.flank.active {
		color: var(--color-text);
		text-decoration: underline;
	}

	/* Design-review change: the three-position initials now live INSIDE the track — each is a full
	   third of it, edge to edge, and is itself the click target (see the fieldset markup above), not
	   a separate row beneath. */
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
		/* All three initials share this color, not just the inactive ones — see the .active rule
		   below for why. */
		color: var(--color-text);
		font-size: var(--font-size-sm);
		font-weight: 400;
		line-height: 1;
		cursor: pointer;
		user-select: none;
	}

	/* Design-review correction: inactive initials are NOT dimmed — every initial stays --color-text so
	   the only thing that moves is the thumb underneath. The selected one flips to --color-accent-text
	   purely because the thumb (--color-accent) has slid under it and needs contrast against that fill
	   (~6.8:1, checked, comfortably past the 4.5:1 AA floor at this font size) — that reads as the
	   thumb passing beneath the text rather than the other segments going inert. State is still never
	   color-only: the active initial also goes bold, per conventions §5's weight/fill/border/text
	   requirement. */
	.segment-label.active {
		color: var(--color-accent-text);
		font-weight: 700;
	}

	.active-name {
		margin: 0;
		color: var(--color-text);
		font-size: var(--font-size-sm);
		text-align: center;
	}

	/* Specimen height: 1.25rem, matching 09B §4.3's explicit call-out for this toggle family — a
	   deliberate exception to the generic --control-height (28px) used by every other control here. */
	/* One declared segment width drives the switch width, every segment, and the thumb. The border
	   lives on .switch with box-sizing: content-box, so it sits OUTSIDE the content box — which
	   means the content box, the flex segments, and the absolutely positioned thumb's containing
	   block are all the same rectangle. Previously the border belonged to an inset .track, so the
	   visible strip was 2px narrower than the box the segments and thumb were measured against and
	   the thumb read as wider than the segment under it.

	   Specimen height: 1.25rem, matching 09B §4.3's call-out for this toggle family — a deliberate
	   exception to the generic --control-height (28px) used by every other control here. */
	.switch {
		--segment-width: 1.25rem;
		position: relative;
		box-sizing: content-box;
		width: calc(var(--segment-width) * var(--segment-count));
		height: 1.25rem;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		flex: 0 0 auto;
	}

	/* Three-position only: the switch itself lays out the segment labels as flex children (flex: 1 1 0
	   each, see .segment-label) so every third of the track is a full-height, edge-to-edge click
	   target with no gap between segments. The two-position .switch has no such children — its labels
	   stay outside, flanking it — so it doesn't need this. */
	.switch.three {
		display: flex;
	}

	/* Design-review fix: the thumb used to live inside a `.travel` wrapper inset 2px from `.switch`,
	   sizing/translating itself against that 4px-narrower box while `.segment-label` sized itself
	   against `.switch` directly — two different boxes gave two different "thirds" and the outer
	   stops drifted ~1.3px off the real segment centers. The thumb is now a direct child of `.switch`,
	   the same box the segment labels flex against, so `width` and `translateX` both resolve against
	   the identical value the segments do. The old 2px inset is now vertical-only (top/bottom), which
	   is purely cosmetic breathing room and doesn't touch the width/offset math. */
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

	input:focus-visible + .flank,
	input:focus-visible + .segment-label {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.help {
		position: absolute;
		bottom: calc(100% + var(--space-1));
		left: 50%;
		z-index: 2;
		transform: translateX(-50%);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
		padding: 2px var(--space-1);
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
