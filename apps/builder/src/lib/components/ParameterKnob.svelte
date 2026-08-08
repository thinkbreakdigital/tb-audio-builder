<script lang="ts">
	import {
		decimalPlaces,
		formatParameterValue,
		keyboardParameterValue,
		parseNumericDraft,
		ratioToValue,
		snapValue,
		valueToRatio,
		type ParameterScale
	} from './parameter-knob.js';

	interface Props {
		id: string;
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		fineStep?: number;
		unit: string;
		decimals?: number;
		scale?: ParameterScale;
		defaultValue: number;
		disabled?: boolean;
		formatValue?: (value: number) => string;
		onlive?: (value: number) => void;
		oncommit?: (value: number) => void;
	}

	let {
		id,
		label,
		value,
		min,
		max,
		step,
		fineStep,
		unit,
		decimals,
		scale = 'linear',
		defaultValue,
		disabled = false,
		formatValue,
		onlive,
		oncommit
	}: Props = $props();

	const DRAG_DISTANCE_PX = 120;
	function initialValue(): number {
		// Capturing the initial prop is intentional; the effect below handles every later prop change.
		return value;
	}

	let displayValue = $state(initialValue());
	let numericDraft = $state(String(initialValue()));
	let numericError = $state('');
	let pointerId: number | null = null;
	let pointerStartY = 0;
	let pointerStartRatio = 0;
	let pointerStartValue = 0;
	let pointerChanged = false;
	let keyboardActive = false;
	let skipNextNumericBlur = false;

	const resolvedDecimals = $derived(decimals ?? decimalPlaces(step));
	const formattedValue = $derived(
		formatValue?.(displayValue) ?? formatParameterValue(displayValue, resolvedDecimals, unit)
	);
	const rotation = $derived(valueToRatio(displayValue, min, max, scale) * 270 - 135);
	const errorId = $derived(`${id}-error`);

	$effect(() => {
		// Prop changes include parameter-bank switches. Updating the complete presentation here invokes
		// no callbacks, so choosing O/S/F or A/D/S/R is never mistaken for an edit.
		if (pointerId !== null || keyboardActive) return;
		const nextValue = snapValue(value, min, max, step);
		displayValue = nextValue;
		numericDraft = nextValue.toFixed(resolvedDecimals);
		numericError = '';
	});

	function updateLive(nextValue: number, effectiveStep = step): void {
		displayValue = snapValue(nextValue, min, max, effectiveStep);
		numericDraft = displayValue.toFixed(resolvedDecimals);
		numericError = '';
		onlive?.(displayValue);
	}

	function commitCurrent(): void {
		oncommit?.(displayValue);
	}

	function handlePointerDown(event: PointerEvent): void {
		if (disabled || pointerId !== null || event.button !== 0) return;
		event.preventDefault();
		pointerId = event.pointerId;
		pointerStartY = event.clientY;
		pointerStartValue = displayValue;
		pointerStartRatio = valueToRatio(displayValue, min, max, scale);
		pointerChanged = false;
		(event.currentTarget as HTMLInputElement).setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent): void {
		if (pointerId !== event.pointerId) return;
		const effectiveStep = event.shiftKey ? (fineStep ?? step / 10) : step;
		const sensitivity = event.shiftKey ? effectiveStep / step : 1;
		const ratio =
			pointerStartRatio + ((pointerStartY - event.clientY) / DRAG_DISTANCE_PX) * sensitivity;
		const nextValue = snapValue(ratioToValue(ratio, min, max, scale), min, max, effectiveStep);
		if (nextValue === displayValue) return;
		pointerChanged = true;
		updateLive(nextValue, effectiveStep);
	}

	function finishPointer(event: PointerEvent, commit: boolean): void {
		if (pointerId !== event.pointerId) return;
		const target = event.currentTarget as HTMLInputElement;
		if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
		pointerId = null;
		if (commit && pointerChanged) commitCurrent();
		else if (!commit && pointerChanged) updateLive(pointerStartValue);
		pointerChanged = false;
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (disabled) return;
		const next = keyboardParameterValue({
			value: displayValue,
			key: event.key,
			min,
			max,
			step,
			fineStep,
			shiftKey: event.shiftKey
		});
		if (next === null) return;
		event.preventDefault();
		keyboardActive = true;
		updateLive(next, event.shiftKey ? (fineStep ?? step / 10) : step);
	}

	function handleKeyUp(event: KeyboardEvent): void {
		if (!keyboardActive) return;
		if (
			![
				'ArrowUp',
				'ArrowRight',
				'ArrowDown',
				'ArrowLeft',
				'PageUp',
				'PageDown',
				'Home',
				'End'
			].includes(event.key)
		) {
			return;
		}
		keyboardActive = false;
		commitCurrent();
	}

	function handleNativeInput(event: Event): void {
		if (pointerId !== null || keyboardActive) return;
		updateLive(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handleNativeChange(): void {
		if (pointerId !== null || keyboardActive) return;
		commitCurrent();
	}

	function resetValue(): void {
		if (disabled) return;
		updateLive(defaultValue);
		commitCurrent();
	}

	function commitNumeric(): void {
		if (disabled) return;
		const parsed = parseNumericDraft(numericDraft, { min, max, step });
		if (!parsed.ok) {
			numericError = `Enter a number from ${min} to ${max}${unit === '' ? '' : ` ${unit}`}.`;
			return;
		}
		updateLive(parsed.value);
		commitCurrent();
	}

	function handleNumericKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			skipNextNumericBlur = true;
			commitNumeric();
			(event.currentTarget as HTMLInputElement).blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			skipNextNumericBlur = true;
			numericDraft = displayValue.toFixed(resolvedDecimals);
			numericError = '';
			(event.currentTarget as HTMLInputElement).blur();
		}
	}

	function handleNumericBlur(): void {
		if (skipNextNumericBlur) {
			skipNextNumericBlur = false;
			return;
		}
		commitNumeric();
	}
</script>

<div class="parameter-knob" class:disabled>
	<label class="parameter-label" for={id}>{label}</label>
	<div class="dial" title={`Double-click to reset ${label}`}>
		<span class="indicator" style:transform={`rotate(${rotation}deg)`} aria-hidden="true"></span>
		<input
			{id}
			class="range"
			type="range"
			{min}
			{max}
			{step}
			value={displayValue}
			{disabled}
			aria-valuetext={formattedValue}
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={(event) => finishPointer(event, true)}
			onpointercancel={(event) => finishPointer(event, false)}
			ondblclick={resetValue}
			onkeydown={handleKeyDown}
			onkeyup={handleKeyUp}
			oninput={handleNativeInput}
			onchange={handleNativeChange}
		/>
	</div>
	<output class="value-readout" for={id}>{formattedValue}</output>
	<div class="numeric-row">
		<input
			class="numeric"
			type="number"
			inputmode="decimal"
			{min}
			{max}
			{step}
			aria-label={`${label} numeric value`}
			aria-invalid={numericError !== ''}
			aria-describedby={numericError === '' ? undefined : errorId}
			value={numericDraft}
			{disabled}
			oninput={(event) => (numericDraft = (event.currentTarget as HTMLInputElement).value)}
			onkeydown={handleNumericKeyDown}
			onblur={handleNumericBlur}
		/>
		<button type="button" class="reset" {disabled} onclick={resetValue} title={`Reset ${label}`}>
			<span aria-hidden="true">R</span>
			<span class="visually-hidden">Reset {label}</span>
		</button>
	</div>
	{#if numericError !== ''}
		<span class="error" id={errorId}>{numericError}</span>
	{/if}
</div>

<style>
	.parameter-knob {
		display: inline-flex;
		width: 76px;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		color: var(--color-text);
	}

	.parameter-label {
		width: 100%;
		overflow: hidden;
		font-size: var(--font-size-sm);
		font-weight: 600;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dial {
		position: relative;
		width: 46px;
		height: 46px;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: 50%;
		background: var(--color-surface);
	}

	.indicator {
		position: absolute;
		inset: 4px 50% 50%;
		width: 2px;
		height: 15px;
		transform-origin: 50% 19px;
		background: var(--color-accent);
		pointer-events: none;
	}

	.range {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: ns-resize;
	}

	.dial:has(.range:focus-visible) {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	.value-readout {
		min-height: 17px;
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
	}

	.numeric-row {
		display: flex;
		width: 100%;
		gap: 2px;
	}

	.numeric {
		width: 0;
		min-width: 0;
		height: 22px;
		flex: 1;
		padding: 0 3px;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-background);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		text-align: right;
	}

	.numeric[aria-invalid='true'] {
		border-color: var(--color-danger);
	}

	.reset {
		width: 22px;
		height: 22px;
		padding: 0;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		font-size: 10px;
		font-weight: 700;
		cursor: pointer;
	}

	.error {
		width: 100%;
		color: var(--color-danger);
		font-size: 10px;
		line-height: 1.25;
	}

	.disabled {
		color: var(--color-text-muted);
	}

	.disabled .dial,
	.disabled button,
	.disabled input {
		cursor: not-allowed;
		opacity: 0.6;
	}
</style>
