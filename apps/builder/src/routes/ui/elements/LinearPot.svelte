<script lang="ts">
	/**
	 * Design specimen — vertical fader for Volume (channel volume and master volume in the
	 * global Mixer). The visible label is "Volume" everywhere; the underlying schema field stays
	 * `gain` (10B §4.3, §4.5 — a deliberate display-only deviation, not a schema rename).
	 *
	 * Self-contained: local state only, no project/audio/persistence writes. Shares the field-reveal,
	 * reset, validation, and keyboard contract in pot-interaction.ts with RotaryPot and
	 * DualRotaryPot; travels vertically via a real <input type="range"> instead of a rotary control,
	 * and — unlike the two rotary controls — lets the native range handle the drag itself rather than
	 * computing it from pointer deltas, since `writing-mode: vertical-lr` already makes that correct.
	 *
	 * The label stays fixed above the fader and stays bound to the range at all times. A click (or
	 * Enter) swaps the value readout below for a number field; double-click anywhere on the shaft
	 * resets, guarded (via createClickInteraction) so it never flashes the field open first.
	 */
	import {
		clamp,
		commitDraftFor,
		createClickInteraction,
		focusAndSelect,
		formatValue,
		handleRangeKeydown
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
	}

	let {
		label = 'Volume',
		value = 0.8,
		min = 0,
		max = 1,
		step = 0.01,
		fineStep = 0.001,
		defaultValue = 0.8,
		decimals = 2
	}: Props = $props();

	const uid = $props.id();
	const rangeId = `${uid}-range`;
	const numberId = `${uid}-number`;
	const errorId = `${uid}-error`;

	// Seeded from the prop's initial value on purpose: the specimen is uncontrolled once mounted.
	// svelte-ignore state_referenced_locally
	let committed = $state(clamp(value, min, max));
	let fieldOpen = $state(false);
	// Writable $derived: recomputes from committed whenever that changes (drag, keys, reset), but
	// free typing can reassign it in between recomputes without fighting the derivation.
	let draft = $derived(formatValue(committed, decimals));
	let error = $state('');

	function commit(next: number) {
		committed = clamp(next, min, max);
		error = '';
	}

	function onRangeInput(event: Event) {
		commit(Number((event.currentTarget as HTMLInputElement).value));
	}

	function openField() {
		fieldOpen = true;
	}

	// The native vertical range already drags itself correctly; onPointerDown only classifies the
	// gesture so a plain click (no drag, no double-click) can reveal the field.
	const clickInteraction = createClickInteraction(openField, () => commit(defaultValue));

	function onRangeKeydown(event: KeyboardEvent) {
		handleRangeKeydown(event, committed, min, max, fineStep, commit, openField);
	}

	function runCommitDraft() {
		commitDraftFor(
			draft,
			min,
			max,
			committed,
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
			draft = formatValue(committed, decimals);
			error = '';
			fieldOpen = false;
			(event.currentTarget as HTMLInputElement).blur();
		}
	}
</script>

<div class="linear-pot">
	<label for={rangeId} class="pot-label">{label}</label>

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
			value={committed}
			oninput={onRangeInput}
			onkeydown={onRangeKeydown}
			onpointerdown={clickInteraction.onPointerDown}
			ondblclick={clickInteraction.onDoubleClick}
			aria-describedby={error ? errorId : undefined}
		/>
	</div>

	<div class="value-slot">
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
			<p class="value-text">{formatValue(committed, decimals)}</p>
		{/if}
	</div>

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
		height: 72px;
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

	.value-text {
		margin: 0;
		font-family: var(--font-mono);
		color: var(--color-text);
	}

	.error {
		margin: 0;
		color: var(--color-danger);
		text-align: center;
	}
</style>
