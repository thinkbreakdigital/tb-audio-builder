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
		shaftHeight = '72px',
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
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		width: fit-content;
		font-size: var(--font-size-sm);
	}

	.pot-label {
		color: var(--color-text);
		font-weight: 700;
		text-align: center;
	}

	/* Fixed height reserves the value readout's space whether it's showing plain text or the
	   swapped-in field, so opening the field never resizes the control or shifts its neighbours. */
	.value-slot {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-width: 64px;
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
		justify-content: center;
		/* Specimen throw: 72px. Production channel strip uses ~140px. */
		height: var(--shaft-height);
	}

	.fader-input {
		appearance: none;
		writing-mode: vertical-lr;
		direction: rtl;
		width: 24px;
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
		width: 6px;
		height: 100%;
		background: var(--color-surface-active);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
	}

	.fader-input::-moz-range-track {
		width: 6px;
		height: 100%;
		background: var(--color-surface-active);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
	}

	.fader-input::-webkit-slider-thumb {
		appearance: none;
		width: 22px;
		height: 11px;
		margin-left: -8px;
		background: var(--color-accent);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
	}

	.fader-input::-moz-range-thumb {
		width: 22px;
		height: 11px;
		background: var(--color-accent);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
	}

	.horizontal {
		width: 100%;
	}

	.horizontal .fader-shaft {
		width: 96px;
		height: 24px;
	}

	.horizontal .fader-input {
		writing-mode: horizontal-tb;
		direction: ltr;
		width: 100%;
		height: 24px;
		cursor: ew-resize;
	}

	.horizontal .fader-input::-webkit-slider-runnable-track {
		width: 100%;
		height: 6px;
	}

	.horizontal .fader-input::-moz-range-track {
		width: 100%;
		height: 6px;
	}

	.horizontal .fader-input::-webkit-slider-thumb {
		width: 11px;
		height: 22px;
		margin-top: -8px;
	}

	.horizontal .fader-input::-moz-range-thumb {
		width: 11px;
		height: 22px;
	}

	.horizontal.compact {
		gap: 0;
	}

	.horizontal.compact .pot-label {
		line-height: 1;
	}

	.horizontal.compact .fader-shaft {
		height: 14px;
	}

	.horizontal.compact .fader-input {
		height: 14px;
	}

	.horizontal.compact .value-slot {
		height: 16px;
		min-width: 0;
	}

	.horizontal.compact .fader-input::-webkit-slider-thumb {
		height: 14px;
		margin-top: -4px;
	}

	.horizontal.compact .fader-input::-moz-range-thumb {
		height: 14px;
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
		color: var(--color-danger);
		text-align: center;
	}
</style>
