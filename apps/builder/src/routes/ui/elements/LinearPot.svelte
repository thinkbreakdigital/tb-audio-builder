<script lang="ts">
	/**
	 * Design specimen — vertical fader for Volume (channel volume and master volume in the
	 * global Mixer). The visible label is "Volume" everywhere; the underlying schema field stays
	 * `gain` (10B §4.3, §4.5 — a deliberate display-only deviation, not a schema rename).
	 *
	 * Self-contained: local state only, no project/audio/persistence writes. Shares the field-reveal,
	 * reset, validation, and keyboard contract in pot-interaction.ts with RotaryPot and DualRotaryPot;
	 * travels vertically via a real <input type="range"> instead of a rotary control.
	 *
	 * Dragging goes through the same startDrag pointer math as the two rotary pots (not a copy of
	 * it — the math was never rotary-specific, just a vertical pixel delta) rather than the native
	 * range's own dragging: a native range jumps the thumb to wherever the pointer went down before
	 * any drag begins, which is wrong for a precision control — a press alone must never move the
	 * value, only movement should. `writing-mode: vertical-lr` still governs native keyboard
	 * direction (Arrow Up increases) and the visual thumb; it no longer drives pointer dragging.
	 *
	 * The label stays fixed above the fader and stays bound to the range at all times. The fader shaft
	 * itself has no click behavior — pointer down on it only drags, and double-click resets to
	 * defaultValue. The value readout below is a real <button>; clicking (or Enter/Space-ing) that is
	 * the only way to reveal the number field, which swaps in over the readout in place.
	 */
	import {
		clamp,
		commitDraftFor,
		focusAndSelect,
		formatValue,
		handleRangeKeydown,
		startDrag
	} from './pot-interaction';

	export interface Props {
		label?: string;
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		fineStep?: number;
		defaultValue?: number;
		decimals?: number;
		orientation?: 'vertical' | 'horizontal';
		shaftHeight?: string;
		showLabel?: boolean;
		showReadout?: boolean;
		density?: 'normal' | 'compact';
	}

	let {
		label = 'Volume',
		value = $bindable(0.8),
		min = 0,
		max = 1,
		step = 0.01,
		fineStep = 0.001,
		defaultValue = 0.8,
		decimals = 2,
		orientation = 'vertical',
		shaftHeight = '96px',
		showLabel = true,
		showReadout = true,
		density = 'normal'
	}: Props = $props();

	const uid = $props.id();
	const rangeId = `${uid}-range`;
	const numberId = `${uid}-number`;
	const errorId = `${uid}-error`;

	let fieldOpen = $state(false);
	// Writable $derived: recomputes from committed whenever that changes (drag, keys, reset), but
	// free typing can reassign it in between recomputes without fighting the derivation.
	let draft = $derived(formatValue(value, decimals));
	let error = $state('');

	function commit(next: number) {
		value = clamp(next, min, max);
		error = '';
	}

	function onRangeInput(event: Event) {
		commit(Number((event.currentTarget as HTMLInputElement).value));
	}

	function openField() {
		fieldOpen = true;
	}

	function onRangeKeydown(event: KeyboardEvent) {
		handleRangeKeydown(event, value, min, max, fineStep, commit);
	}

	function onPointerDown(event: PointerEvent) {
		startDrag(event, value, min, max, step, fineStep, commit);
	}

	function onDoubleClick() {
		commit(defaultValue);
	}

	function runCommitDraft() {
		commitDraftFor(
			draft,
			min,
			max,
			value,
			decimals,
			(m) => (error = m),
			(d) => (draft = d),
			commit
		);
	}

	function handleFieldBlur() {
		runCommitDraft();
		if (!error) fieldOpen = false;
	}

	function handleFieldKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			runCommitDraft();
			if (!error) {
				fieldOpen = false;
				(event.currentTarget as HTMLInputElement).blur();
			}
		} else if (event.key === 'Escape') {
			draft = formatValue(value, decimals);
			error = '';
			fieldOpen = false;
			(event.currentTarget as HTMLInputElement).blur();
		}
	}
</script>

<div
	class="linear-pot"
	class:horizontal={orientation === 'horizontal'}
	class:compact={density === 'compact'}
	class:shaftOnly={!showLabel && !showReadout}
	style={`--shaft-height: ${shaftHeight};`}
>
	{#if showLabel}<label for={rangeId} class="pot-label">{label}</label>{/if}

	<div class="fader-shaft">
		<!--
			Vertical fader via writing-mode: vertical-lr + direction: rtl (the modern standard
			approach) rather than a rotation transform, so this stays a real, keyboard-operable
			<input type="range">: Arrow Up increases, Arrow Down decreases, matching a physical
			fader pushed away from the operator. Double-click anywhere on the shaft — the whole
			control body, not just the thumb — resets to defaultValue.
		-->
		<input
			id={rangeId}
			class="fader-input"
			type="range"
			{min}
			{max}
			{step}
			{value}
			oninput={onRangeInput}
			onkeydown={onRangeKeydown}
			onpointerdown={orientation === 'vertical' ? onPointerDown : undefined}
			ondblclick={onDoubleClick}
			aria-describedby={error ? errorId : undefined}
		/>
	</div>

	{#if showReadout}<div class="value-slot">
			{#if fieldOpen}
				<label for={numberId} class="visually-hidden">{label}</label>
				<input
					id={numberId}
					class="field-input"
					type="number"
					{min}
					{max}
					{step}
					value={draft}
					use:focusAndSelect
					oninput={(event) => (draft = (event.currentTarget as HTMLInputElement).value)}
					onblur={handleFieldBlur}
					onkeydown={handleFieldKeydown}
					aria-invalid={error ? 'true' : undefined}
					aria-describedby={error ? errorId : undefined}
				/>
			{:else}
				<button
					type="button"
					class="value-readout"
					onclick={openField}
					aria-label={`Edit ${label} value`}
				>
					{formatValue(value, decimals)}
				</button>
			{/if}
		</div>{/if}

	{#if error}
		<p id={errorId} class="error">{error}</p>
	{/if}
</div>

<style>
	.linear-pot {
		box-sizing: border-box;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		/* Declared footprint: label 16 + readout 32 + shaft 96 + a 16px bottom pad = 160 tall,
		   64 wide (00-conventions.md §5.4). Order is visual, not DOM order — the readout stays
		   above the shaft (see the `order` rules below) to match the channel strip, where the
		   dB readout sits above the fader rail. The 32px hit area is narrower than the 64px
		   module, so centering it already leaves the 16px inset on each side; the 16px pad below
		   the shaft is real padding, not a centering side-effect. */
		width: var(--mod-2);
		padding-bottom: var(--pad-3);
		font-size: var(--font-size-sm);
	}

	/* Vertical is the only orientation whose readout sits above the shaft; horizontal (including
	   compact Pan) keeps the natural label/shaft/value source order. */
	.linear-pot:not(.horizontal) .fader-shaft {
		order: 2;
	}

	.linear-pot:not(.horizontal) .value-slot {
		order: 1;
	}

	/* In a mixer strip the shaft is the whole control footprint. The specimen-only bottom pad
	   must not turn a seven-band shaft into a 240px child inside a 224px rail. */
	.linear-pot.shaftOnly {
		padding-bottom: 0;
	}

	.pot-label {
		flex-shrink: 0;
		width: 100%;
		height: var(--label-line);
		line-height: var(--label-line);
		overflow: hidden;
		color: var(--color-text);
		font-weight: 700;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Fixed height reserves the value readout's space whether it's showing plain text or the
	   swapped-in field, so opening the field never resizes the control or shifts its neighbours. */
	.value-slot {
		position: relative;
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: var(--control-height);
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

	.field-input {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 0 var(--space-1);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--color-text);
		background: var(--color-background);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		text-align: center;
	}

	.field-input:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.field-input[aria-invalid='true'] {
		border-color: var(--color-danger);
	}

	.fader-shaft {
		display: flex;
		flex-shrink: 0;
		justify-content: center;
		/* Specimen throw: 96px (label 16 + readout 32 + shaft 96 + pad 16 = 160). A mixer strip
		   passes --mixer-level-rail-height (224px) explicitly. */
		height: var(--shaft-height);
	}

	.fader-input {
		appearance: none;
		writing-mode: vertical-lr;
		direction: rtl;
		width: var(--fader-hit-width);
		height: 100%;
		margin: 0;
		background: transparent;
		cursor: ns-resize;
		/* Without this, dragging the fader with a mouse selects surrounding page text and leaves a
		   smeared selection behind once the drag ends. */
		user-select: none;
	}

	.fader-input:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.fader-input::-webkit-slider-runnable-track {
		width: var(--fader-track);
		height: 100%;
		background: var(--color-surface-active);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
	}

	.fader-input::-moz-range-track {
		width: var(--fader-track);
		height: 100%;
		background: var(--color-surface-active);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
	}

	/* Thumb centers on the track: offset is (track - thumb) / 2, e.g. -8px for an 8px track and a
	   24px thumb (00-conventions.md §5.4). */
	.fader-input::-webkit-slider-thumb {
		appearance: none;
		width: var(--fader-thumb-long);
		height: var(--fader-thumb-short);
		margin-left: calc((var(--fader-track) - var(--fader-thumb-long)) / 2);
		background: var(--color-accent);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
	}

	.fader-input::-moz-range-thumb {
		width: var(--fader-thumb-long);
		height: var(--fader-thumb-short);
		background: var(--color-accent);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
	}

	.horizontal {
		width: fit-content;
		padding-bottom: 0;
	}

	.horizontal .fader-shaft {
		width: var(--mod-3);
		height: var(--control-height);
	}

	.horizontal .fader-input {
		writing-mode: horizontal-tb;
		direction: ltr;
		width: 100%;
		height: var(--control-height);
		cursor: ew-resize;
	}

	.horizontal .fader-input::-webkit-slider-runnable-track {
		width: 100%;
		height: var(--fader-track);
	}

	.horizontal .fader-input::-moz-range-track {
		width: 100%;
		height: var(--fader-track);
	}

	.horizontal .fader-input::-webkit-slider-thumb {
		width: var(--fader-thumb-short);
		height: var(--fader-thumb-long);
		margin-top: calc((var(--fader-track) - var(--fader-thumb-long)) / 2);
	}

	.horizontal .fader-input::-moz-range-thumb {
		width: var(--fader-thumb-short);
		height: var(--fader-thumb-long);
	}

	/* Pan control: one 32px band, laid out inline instead of stacked — label 24 + gap 8 + shaft 48
	   + gap 8 + value 24 = 112 (00-conventions.md §5.4). */
	.horizontal.compact {
		flex-direction: row;
		align-items: center;
		gap: var(--space-2);
		height: var(--control-height);
	}

	.horizontal.compact .pot-label {
		width: var(--space-5);
		height: 100%;
		line-height: var(--control-height);
	}

	.horizontal.compact .fader-shaft {
		width: calc(var(--u) * 6);
		height: 100%;
	}

	.horizontal.compact .fader-input {
		height: 100%;
	}

	.horizontal.compact .value-slot {
		width: var(--space-5);
		height: 100%;
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
		position: absolute;
		inset-block-start: 100%;
		inset-inline: 0;
		z-index: 1;
		margin: 0;
		background: var(--color-background);
		color: var(--color-danger);
		text-align: center;
	}
</style>
