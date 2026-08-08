<script lang="ts">
	/**
	 * Design specimen only — local state, zero wiring. See spec/implementation/00-conventions.md §5.2.
	 *
	 * The single rotary control for continuous parameters. Visually rotary, built on a native
	 * <input type="range"> so the accessibility tree keeps real slider semantics: keyboard users and
	 * screen readers interact with a real slider, not a div. The dial is a plain-CSS circle (border +
	 * background) with a rotated indicator line bound directly to the value — no canvas, gradient,
	 * shadow, or SVG filter, and no transition on the rotation so a drag tracks the pointer instantly.
	 *
	 * No reset button and no permanent number field: a click (or Enter) on the dial is the only way
	 * in, and the field swaps in for the value readout on demand — the label stays put and stays
	 * bound to the range the whole time, so the range never loses its accessible name. Double-click
	 * on the dial is the only reset path, and it's guarded against ever flashing the field open (see
	 * createClickInteraction in pot-interaction.ts, shared with DualRotaryPot and LinearPot).
	 */
	import {
		angleFor,
		clamp,
		commitDraftFor,
		createClickInteraction,
		focusAndSelect,
		formatValue,
		handleRangeKeydown,
		startDrag,
		type Scale
	} from './pot-interaction';

	export interface Props {
		label?: string;
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		fineStep?: number;
		unit?: string;
		decimals?: number;
		defaultValue?: number;
		scale?: Scale;
	}

	let {
		label = 'Cutoff',
		value = $bindable(1000),
		min = 20,
		max = 20000,
		step = 100,
		fineStep = 1,
		unit = 'Hz',
		decimals = 0,
		defaultValue = 1000,
		scale = 'log'
	}: Props = $props();

	const uid = $props.id();
	const rangeId = `${uid}-range`;
	const numberId = `${uid}-number`;
	const errorId = `${uid}-error`;

	let fieldOpen = $state(false);
	// Writable $derived: recomputes from value whenever it changes (drag, keys, reset), but free
	// typing can reassign it in between recomputes without fighting the derivation.
	let draft = $derived(formatValue(value, decimals));
	let error = $state('');

	const angleDeg = $derived(angleFor(value, min, max, scale));

	function commit(next: number) {
		value = clamp(next, min, max);
		error = '';
	}

	function handleRangeInput(event: Event) {
		commit(Number((event.currentTarget as HTMLInputElement).value));
	}

	function openField() {
		fieldOpen = true;
	}

	const clickInteraction = createClickInteraction(openField, () => commit(defaultValue));

	function handleKeydown(event: KeyboardEvent) {
		handleRangeKeydown(event, value, min, max, fineStep, commit, openField);
	}

	function handlePointerDown(event: PointerEvent) {
		clickInteraction.onPointerDown(event);
		startDrag(event, value, min, max, step, fineStep, commit);
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

<div class="pot">
	<label for={rangeId}>{label}</label>

	<div class="dial">
		<input
			id={rangeId}
			class="range-input"
			type="range"
			{min}
			{max}
			{step}
			value={String(value)}
			oninput={handleRangeInput}
			onkeydown={handleKeydown}
			onpointerdown={handlePointerDown}
			ondblclick={clickInteraction.onDoubleClick}
			aria-valuetext={`${formatValue(value, decimals)} ${unit}`}
			aria-describedby={error ? errorId : undefined}
		/>
		<div class="dial-body" aria-hidden="true">
			<div class="indicator" style={`transform: rotate(${angleDeg}deg);`}></div>
		</div>
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
			<p class="value-text">{formatValue(value, decimals)} {unit}</p>
		{/if}
	</div>

	{#if error}
		<p id={errorId} class="error">{error}</p>
	{/if}
</div>

<style>
	.pot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		width: 84px;
		font-family: var(--font-sans);
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	label {
		color: var(--color-text-muted);
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
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
		text-align: center;
	}

	.field-input:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.field-input[aria-invalid='true'] {
		border-color: var(--color-danger);
	}

	/* Specimen dial: 56px, matching the ~120x96px catalog cell this sits in. */
	.dial {
		position: relative;
		width: 56px;
		height: 56px;
	}

	.range-input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: ns-resize;
	}

	.dial-body {
		position: absolute;
		inset: 0;
		/* Lets pointer events fall through to .range-input, which is the real drag/keyboard target. */
		pointer-events: none;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: 50%;
		background: var(--color-surface);
	}

	/* Focus paints on the visual body, not the opacity:0 input the outline would otherwise vanish on. */
	.range-input:focus-visible + .dial-body {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.indicator {
		position: absolute;
		bottom: 50%;
		left: 50%;
		width: 2px;
		height: 20px;
		margin-left: -1px;
		background: var(--color-text);
		transform-origin: bottom center;
	}

	.value-text {
		margin: 0;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
	}

	.error {
		margin: 0;
		max-width: 84px;
		color: var(--color-danger);
		text-align: center;
	}
</style>
