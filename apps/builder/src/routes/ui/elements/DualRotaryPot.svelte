<script lang="ts">
	/**
	 * Design specimen only — local state, zero wiring. See spec/implementation/00-conventions.md §5.2.
	 *
	 * Concentric dual pot in the guitar-pedal idiom: an outer ring and an inner disc share one
	 * footprint and control two related parameters. Not a second rotary implementation — the angle
	 * mapping, drag, keyboard, click-to-reveal, and reset behavior are RotaryPot's, imported from
	 * pot-interaction.ts and called once per ring so both share the exact same feel.
	 *
	 * No reset buttons: neither ring nor the disc has any click behavior of its own — pointer down
	 * only drags, and double-click on the control body resets to defaultValue. The paired heading's
	 * names stay fixed and stay bound to their ranges at all times. Each half of the value line below
	 * is its own real <button>; clicking (or Enter/Space-ing) one swaps that half for its own number
	 * field, independently of the other, so both values stay readable while one is being edited —
	 * the name-swap approach an earlier pass used ate the wrong real estate.
	 *
	 * Either ring can independently be scale:'log' (e.g. cutoff, or oscillator start/end frequency
	 * paired concentrically) — a log ring steps in cents, not Hz, for the same reason as RotaryPot.
	 * See pot-interaction.ts for the shared cents maths.
	 */
	import {
		angleFor,
		clamp,
		commitDraftFor,
		focusAndSelect,
		formatValue,
		handleLogRangeKeydown,
		handleRangeKeydown,
		startDrag,
		startLogDrag,
		type Scale
	} from './pot-interaction';

	export interface Props {
		outerLabel?: string;
		/** Visible heading text only (e.g. "Cut"). Falls back to outerLabel if not supplied. */
		outerShortLabel?: string;
		outerValue?: number;
		outerMin?: number;
		outerMax?: number;
		outerStep?: number;
		outerFineStep?: number;
		outerUnit?: string;
		outerDecimals?: number;
		outerDefaultValue?: number;
		outerScale?: Scale;
		innerLabel?: string;
		/** Visible heading text only (e.g. "Res"). Falls back to innerLabel if not supplied. */
		innerShortLabel?: string;
		innerValue?: number;
		innerMin?: number;
		innerMax?: number;
		innerStep?: number;
		innerFineStep?: number;
		innerUnit?: string;
		innerDecimals?: number;
		innerDefaultValue?: number;
		innerScale?: Scale;
	}

	let {
		outerLabel = 'Cutoff',
		outerShortLabel = 'Cut',
		outerValue = $bindable(1000),
		outerMin = 20,
		outerMax = 20000,
		outerStep = 100,
		outerFineStep = 1,
		outerUnit = 'Hz',
		outerDecimals = 0,
		outerDefaultValue = 1000,
		outerScale = 'log',
		innerLabel = 'Resonance',
		innerShortLabel = 'Res',
		innerValue = $bindable(0.7),
		innerMin = 0.1,
		innerMax = 20,
		innerStep = 0.5,
		innerFineStep = 0.1,
		innerUnit = 'Q',
		innerDecimals = 1,
		innerDefaultValue = 0.7,
		innerScale = 'linear'
	}: Props = $props();

	// Guards the case where a caller overrides the full label but passes an empty short label:
	// falls back to the full name rather than showing a blank heading.
	const outerHeadingText = $derived((outerShortLabel || outerLabel).toUpperCase());
	const innerHeadingText = $derived((innerShortLabel || innerLabel).toUpperCase());

	const uid = $props.id();
	const outerRangeId = `${uid}-outer-range`;
	const innerRangeId = `${uid}-inner-range`;
	const outerNumberId = `${uid}-outer-number`;
	const innerNumberId = `${uid}-inner-number`;
	const outerErrorId = `${uid}-outer-error`;
	const innerErrorId = `${uid}-inner-error`;

	/* Outer 56px matches RotaryPot's dial exactly, so the two read as one family. Inner disc 34px
	   leaves an 11px ring band (56 - 34 = 22, halved). That is narrower than the 16px this file
	   originally settled on as the minimum reliable pointer target at 200% zoom — flagged in the
	   report rather than silently reverting the outer diameter, per the coordinator's instruction. */
	const OUTER_DIAMETER = 56;
	const INNER_DIAMETER = 34;

	let outerFieldOpen = $state(false);
	let innerFieldOpen = $state(false);
	// Writable $derived: recomputes from its value whenever that changes (drag, keys, reset), but
	// free typing can reassign it in between recomputes without fighting the derivation.
	let outerDraft = $derived(formatValue(outerValue, outerDecimals));
	let innerDraft = $derived(formatValue(innerValue, innerDecimals));
	let outerError = $state('');
	let innerError = $state('');

	const outerAngleDeg = $derived(angleFor(outerValue, outerMin, outerMax, outerScale));
	const innerAngleDeg = $derived(angleFor(innerValue, innerMin, innerMax, innerScale));

	function readout(next: number, unit: string, decimals: number): string {
		// Matches the brief's own example formatting (1.2kHz / 4.0Q): no space before the unit, and
		// Hz collapses to kHz once the value reads more naturally that way.
		if (unit === 'Hz' && next >= 1000) return `${(next / 1000).toFixed(1)}kHz`;
		return `${next.toFixed(decimals)}${unit}`;
	}

	function commitOuter(next: number) {
		outerValue = clamp(next, outerMin, outerMax);
		outerError = '';
	}

	function commitInner(next: number) {
		innerValue = clamp(next, innerMin, innerMax);
		innerError = '';
	}

	function openOuterField() {
		outerFieldOpen = true;
	}

	function openInnerField() {
		innerFieldOpen = true;
	}

	function handleOuterKeydown(event: KeyboardEvent) {
		if (outerScale === 'log') {
			handleLogRangeKeydown(event, outerValue, outerMin, outerMax, commitOuter);
		} else {
			handleRangeKeydown(event, outerValue, outerMin, outerMax, outerFineStep, commitOuter);
		}
	}

	function handleInnerKeydown(event: KeyboardEvent) {
		if (innerScale === 'log') {
			handleLogRangeKeydown(event, innerValue, innerMin, innerMax, commitInner);
		} else {
			handleRangeKeydown(event, innerValue, innerMin, innerMax, innerFineStep, commitInner);
		}
	}

	function handleOuterPointerDown(event: PointerEvent) {
		if (outerScale === 'log') {
			startLogDrag(event, outerValue, outerMin, outerMax, commitOuter);
		} else {
			startDrag(event, outerValue, outerMin, outerMax, outerStep, outerFineStep, commitOuter);
		}
	}

	function handleInnerPointerDown(event: PointerEvent) {
		if (innerScale === 'log') {
			startLogDrag(event, innerValue, innerMin, innerMax, commitInner);
		} else {
			startDrag(event, innerValue, innerMin, innerMax, innerStep, innerFineStep, commitInner);
		}
	}

	function handleOuterDoubleClick() {
		commitOuter(outerDefaultValue);
	}

	function handleInnerDoubleClick() {
		commitInner(innerDefaultValue);
	}

	function runCommitOuterDraft() {
		commitDraftFor(
			outerDraft,
			outerMin,
			outerMax,
			outerValue,
			outerDecimals,
			(m) => (outerError = m),
			(d) => (outerDraft = d),
			commitOuter
		);
	}

	function runCommitInnerDraft() {
		commitDraftFor(
			innerDraft,
			innerMin,
			innerMax,
			innerValue,
			innerDecimals,
			(m) => (innerError = m),
			(d) => (innerDraft = d),
			commitInner
		);
	}

	function handleOuterFieldBlur() {
		runCommitOuterDraft();
		if (!outerError) outerFieldOpen = false;
	}

	function handleInnerFieldBlur() {
		runCommitInnerDraft();
		if (!innerError) innerFieldOpen = false;
	}

	function handleOuterFieldKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			runCommitOuterDraft();
			if (!outerError) {
				outerFieldOpen = false;
				(event.currentTarget as HTMLInputElement).blur();
			}
		} else if (event.key === 'Escape') {
			outerDraft = formatValue(outerValue, outerDecimals);
			outerError = '';
			outerFieldOpen = false;
			(event.currentTarget as HTMLInputElement).blur();
		}
	}

	function handleInnerFieldKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			runCommitInnerDraft();
			if (!innerError) {
				innerFieldOpen = false;
				(event.currentTarget as HTMLInputElement).blur();
			}
		} else if (event.key === 'Escape') {
			innerDraft = formatValue(innerValue, innerDecimals);
			innerError = '';
			innerFieldOpen = false;
			(event.currentTarget as HTMLInputElement).blur();
		}
	}
</script>

<div class="pot">
	<p class="pair-heading">
		<!-- Visible text is the compact initial; aria-label carries the full name as the range's
		     accessible name (09B §4.3), and title gives sighted mouse users the same on hover. -->
		<label for={outerRangeId} class="name-label" aria-label={outerLabel} title={outerLabel}>
			{outerHeadingText}
		</label>

		<!--
			One glyph, not two. The semicircle is the outer ring and the dot is the inner disc; each
			has its own lead line running out to the name it drives, so which control is which is
			read off the connection rather than guessed. The arc is deliberately open on the right so
			the inner disc's lead line can exit through the gap.
		-->
		<svg class="glyph" width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
			<!-- Outer ring: semicircle open to the right, lead line out to the left-hand name. -->
			<path
				d="M11 1 A5 5 0 0 0 11 11"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linecap="round"
			/>
			<path d="M6 6 H0.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
			<!-- Inner disc: dot at the centre, lead line out through the open side to the right. -->
			<circle cx="11" cy="6" r="1.9" fill="currentColor" />
			<path d="M13.6 6 H25.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
		</svg>

		<label for={innerRangeId} class="name-label" aria-label={innerLabel} title={innerLabel}>
			{innerHeadingText}
		</label>
	</p>

	<div class="dial" style={`--outer-d: ${OUTER_DIAMETER}px; --inner-d: ${INNER_DIAMETER}px;`}>
		<input
			id={outerRangeId}
			class="range-input outer"
			type="range"
			min={outerMin}
			max={outerMax}
			step={outerStep}
			value={String(outerValue)}
			oninput={(event) => commitOuter(Number((event.currentTarget as HTMLInputElement).value))}
			onkeydown={handleOuterKeydown}
			onpointerdown={handleOuterPointerDown}
			ondblclick={handleOuterDoubleClick}
			aria-valuetext={readout(outerValue, outerUnit, outerDecimals)}
			aria-describedby={outerError ? outerErrorId : undefined}
		/>

		<input
			id={innerRangeId}
			class="range-input inner"
			type="range"
			min={innerMin}
			max={innerMax}
			step={innerStep}
			value={String(innerValue)}
			oninput={(event) => commitInner(Number((event.currentTarget as HTMLInputElement).value))}
			onkeydown={handleInnerKeydown}
			onpointerdown={handleInnerPointerDown}
			ondblclick={handleInnerDoubleClick}
			aria-valuetext={readout(innerValue, innerUnit, innerDecimals)}
			aria-describedby={innerError ? innerErrorId : undefined}
		/>

		<div class="dial-body" aria-hidden="true">
			<div class="ring">
				<div
					class="indicator outer-indicator"
					style={`transform: rotate(${outerAngleDeg}deg);`}
				></div>
			</div>
			<div class="disc">
				<div
					class="indicator inner-indicator"
					style={`transform: rotate(${innerAngleDeg}deg);`}
				></div>
			</div>
		</div>
	</div>

	<p class="value-line">
		<span class="value-half">
			{#if outerFieldOpen}
				<label for={outerNumberId} class="visually-hidden">{outerLabel}</label>
				<input
					id={outerNumberId}
					class="inline-field"
					type="number"
					min={outerMin}
					max={outerMax}
					step={outerStep}
					value={outerDraft}
					use:focusAndSelect
					oninput={(event) => (outerDraft = (event.currentTarget as HTMLInputElement).value)}
					onblur={handleOuterFieldBlur}
					onkeydown={handleOuterFieldKeydown}
					aria-invalid={outerError ? 'true' : undefined}
					aria-describedby={outerError ? outerErrorId : undefined}
				/>
			{:else}
				<button
					type="button"
					class="value-readout"
					onclick={openOuterField}
					aria-label={`Edit ${outerLabel} value`}
				>
					{readout(outerValue, outerUnit, outerDecimals)}
				</button>
			{/if}
		</span>
		<span class="value-sep">/</span>
		<span class="value-half">
			{#if innerFieldOpen}
				<label for={innerNumberId} class="visually-hidden">{innerLabel}</label>
				<input
					id={innerNumberId}
					class="inline-field"
					type="number"
					min={innerMin}
					max={innerMax}
					step={innerStep}
					value={innerDraft}
					use:focusAndSelect
					oninput={(event) => (innerDraft = (event.currentTarget as HTMLInputElement).value)}
					onblur={handleInnerFieldBlur}
					onkeydown={handleInnerFieldKeydown}
					aria-invalid={innerError ? 'true' : undefined}
					aria-describedby={innerError ? innerErrorId : undefined}
				/>
			{:else}
				<button
					type="button"
					class="value-readout"
					onclick={openInnerField}
					aria-label={`Edit ${innerLabel} value`}
				>
					{readout(innerValue, innerUnit, innerDecimals)}
				</button>
			{/if}
		</span>
	</p>

	{#if outerError}
		<p id={outerErrorId} class="error">{outerError}</p>
	{/if}
	{#if innerError}
		<p id={innerErrorId} class="error">{innerError}</p>
	{/if}
</div>

<style>
	.pot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		/* min-width, not a fixed width: the heading and value line size to their own content, so if
		   either is ever wider than 112px it grows the pot instead of visually overflowing it — the
		   bug the CUT/RES shortening above was fixing. Comfortably inside the ~140px catalog column. */
		min-width: 112px;
		font-family: var(--font-sans);
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	.pair-heading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		margin: 0;
		color: var(--color-text-muted);
	}

	.glyph {
		flex: none;
		color: var(--color-text-muted);
	}

	.name-label {
		flex: none;
		white-space: nowrap;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.inline-field {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 0 var(--space-1);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
		text-align: center;
	}

	.inline-field:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.inline-field[aria-invalid='true'] {
		border-color: var(--color-danger);
	}

	.dial {
		position: relative;
		width: var(--outer-d);
		height: var(--outer-d);
	}

	.range-input {
		position: absolute;
		margin: 0;
		opacity: 0;
		cursor: ns-resize;
		/* Without this, dragging either (invisible) range with a mouse selects surrounding page text
		   and leaves a smeared selection behind once the drag ends. */
		user-select: none;
	}

	.range-input.outer {
		inset: 0;
	}

	/* Centered over the inner disc; sits later in the DOM than .outer so it wins pointer hit-testing
	   inside its own box, leaving the surrounding ring band to the outer input beneath it. */
	.range-input.inner {
		top: calc((var(--outer-d) - var(--inner-d)) / 2);
		left: calc((var(--outer-d) - var(--inner-d)) / 2);
		width: var(--inner-d);
		height: var(--inner-d);
	}

	.dial-body {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.ring {
		position: absolute;
		inset: 0;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: 50%;
		background: var(--color-surface-active);
	}

	.disc {
		position: absolute;
		top: calc((var(--outer-d) - var(--inner-d)) / 2);
		left: calc((var(--outer-d) - var(--inner-d)) / 2);
		width: var(--inner-d);
		height: var(--inner-d);
		border: var(--border-width) solid var(--color-border);
		border-radius: 50%;
		background: var(--color-surface);
	}

	.range-input.outer:focus-visible ~ .dial-body .ring {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.range-input.inner:focus-visible ~ .dial-body .disc {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.indicator {
		position: absolute;
		bottom: 50%;
		left: 50%;
		width: 2px;
		margin-left: -1px;
		background: var(--color-text);
		transform-origin: bottom center;
	}

	/* Outer indicator reaches almost to the rim; the disc (painted after it) masks the portion inside
	   the disc radius, so only the ring band ever shows a line — no separate clip path needed. */
	.outer-indicator {
		height: 25px;
	}

	.inner-indicator {
		height: 14px;
	}

	.value-line {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		margin: 0;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
	}

	.value-sep {
		flex: none;
	}

	/* Fixed height reserves each half's space whether it's showing plain text or the swapped-in
	   field, so opening either field never resizes the control or shifts its neighbours. */
	.value-half {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 40px;
		height: var(--control-height);
	}

	/* A readout that happens to be clickable, not a chunky button: no control-height box, no border —
	   just the hover/focus affordance below plus the standard focus ring. */
	.value-readout {
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		border: none;
		background: none;
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		white-space: nowrap;
		cursor: pointer;
		transition: color 100ms;
	}

	.value-readout:hover {
		color: var(--color-text);
		text-decoration: underline;
	}

	.value-readout:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	@media (prefers-reduced-motion: reduce) {
		.value-readout {
			transition: none;
		}
	}

	.error {
		margin: 0;
		max-width: 100%;
		color: var(--color-danger);
		text-align: center;
	}
</style>
