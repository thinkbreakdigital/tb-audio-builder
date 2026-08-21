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
	 * No reset button and no permanent number field. The dial itself has no click behavior at all —
	 * pointer down on it only drags, and double-click resets to defaultValue. The value readout below
	 * is a real <button>, and clicking (or Enter/Space-ing) that is the only way to reveal the number
	 * field, which swaps in over the readout in place. The label stays put above the dial and bound
	 * to the range the whole time, so the range never loses its accessible name.
	 *
	 * scale:'log' steps in cents, not Hz: a fixed number of Hz is a near-semitone jump at 20Hz and
	 * inaudible at 15kHz, so every step (keyboard or drag) multiplies by a constant musical interval
	 * instead. The native range still holds real Hz — aria-valuetext already announces the formatted
	 * frequency, so it stays meaningful with no further accessibility change needed. See
	 * pot-interaction.ts for the shared cents maths and why linear parameters never touch it.
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
		size?: 'normal' | 'compact';
		hideLabel?: boolean;
		disabled?: boolean;
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
		scale = 'log',
		size = 'normal',
		hideLabel = false,
		disabled = false
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
		if (disabled) return;
		fieldOpen = true;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (scale === 'log') {
			handleLogRangeKeydown(event, value, min, max, commit);
		} else {
			handleRangeKeydown(event, value, min, max, fineStep, commit);
		}
	}

	function handlePointerDown(event: PointerEvent) {
		if (disabled) return;
		if (scale === 'log') {
			startLogDrag(event, value, min, max, commit);
		} else {
			startDrag(event, value, min, max, step, fineStep, commit);
		}
	}

	function handleDoubleClick() {
		if (disabled) return;
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

<div class="pot" class:compact={size === 'compact'} class:label-hidden={hideLabel} class:disabled>
	<label for={rangeId} class:visually-hidden={hideLabel}>{label}</label>

	<div class="dial">
		<input
			id={rangeId}
			class="range-input"
			type="range"
			{min}
			{max}
			{step}
			{disabled}
			value={String(value)}
			oninput={handleRangeInput}
			onkeydown={handleKeydown}
			onpointerdown={handlePointerDown}
			ondblclick={handleDoubleClick}
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
				{disabled}
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
				{disabled}
				onclick={openField}
				aria-label={`Edit ${label} value`}
			>
				{formatValue(value, decimals)}
				{unit}
			</button>
		{/if}
	</div>

	{#if error}
		<p id={errorId} class="error">{error}</p>
	{/if}
</div>

<style>
	.pot {
		box-sizing: border-box;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		/* Declared footprint, not a min-width: label 16 + dial 48 + readout band 32 = 96 tall,
		   64 wide (00-conventions.md §5.4). The 48px dial is narrower than the 64px module, so
		   centering it already leaves the 8px inset on each side — no horizontal padding needed. */
		width: var(--mod-2);
		height: var(--band-3);
		font-family: var(--font-sans);
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	.pot.compact {
		/* Compact: label 16 + dial 32 + readout 16 = 64 tall, same 64-wide module. */
		height: var(--band-2);
	}

	.pot.label-hidden {
		justify-content: center;
	}

	.pot.disabled {
		opacity: 0.55;
	}

	.disabled .range-input,
	.disabled .value-readout {
		cursor: not-allowed;
	}

	label {
		flex-shrink: 0;
		width: 100%;
		height: var(--label-line);
		line-height: var(--label-line);
		overflow: hidden;
		color: var(--color-text-muted);
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

	.compact .value-slot {
		height: var(--readout-line);
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

	/* Dial size is set by the production instrument panel, not this catalog cell — see
	   00-conventions.md §5.4. Default band: label 16 + dial 48 + readout 32 = 96. Compact band:
	   label 16 + dial 32 + readout 16 = 64. */
	.dial {
		position: relative;
		flex-shrink: 0;
		width: var(--dial-size);
		height: var(--dial-size);
	}

	.compact .dial {
		width: var(--dial-size-compact);
		height: var(--dial-size-compact);
	}

	.compact .indicator {
		height: var(--dial-indicator-length-compact);
	}

	.range-input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: ns-resize;
		/* Without this, dragging the (invisible) range with a mouse selects surrounding page text and
		   leaves a smeared selection behind once the drag ends. */
		user-select: none;
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
		height: var(--dial-indicator-length);
		margin-left: -1px;
		background: var(--color-text);
		transform-origin: bottom center;
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

	/* Out of flow, like SegmentSwitch's .help: a validation message must never change the
	   module's footprint (00-conventions.md §5.4). Still in the a11y tree and wired through the
	   same aria-describedby as before — only its visual position moved. */
	.error {
		position: absolute;
		top: 100%;
		left: 50%;
		z-index: 2;
		width: max-content;
		max-width: var(--mod-3);
		margin: var(--pad-1) 0 0;
		transform: translateX(-50%);
		color: var(--color-danger);
		text-align: center;
	}
</style>
