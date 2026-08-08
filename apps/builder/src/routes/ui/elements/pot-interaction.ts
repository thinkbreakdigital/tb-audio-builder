/**
 * Shared interaction logic for the pot family — RotaryPot, DualRotaryPot, LinearPot. Pure functions
 * and one Svelte action; no component $state lives here. Each component keeps its own reactive state
 * (value, draft, error, fieldOpen) and passes read/write callbacks in, so the drag feel, the
 * fine-step behavior, and the field-reveal/validation rules are identical across all three without
 * forcing them to share a single rendered component.
 *
 * The control body (dial/ring/disc/fader shaft) only drags and double-click-resets — it has no click
 * behavior of its own, so there's no click-vs-drag gesture to classify here. The field opens only
 * from an explicit click (or Enter/Space, being a real button) on the value-readout button that sits
 * next to the control, which each component wires up on its own.
 *
 * Design specimen support code only — no imports from $lib/state, $lib/client, or any action module.
 */

export type Scale = 'linear' | 'log';

/* Conventional hardware-pot travel: -135deg (min) through 0deg (straight up) to 135deg (max). Used
   by the two rotary controls; LinearPot ignores it. */
export const SWEEP_START_DEG = -135;
export const SWEEP_END_DEG = 135;

/* Vertical drag distance, in px, per single base-step increment. Shift swaps in fineStep at the same
   pixel rate, which is what makes the fine drag read as more precise rather than just slower. */
export const DRAG_PIXELS_PER_STEP = 4;

export function clamp(next: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, next));
}

export function formatValue(next: number, decimals: number): string {
	return next.toFixed(decimals);
}

export function fractionFor(next: number, lo: number, hi: number, scale: Scale): number {
	const clamped = clamp(next, lo, hi);
	if (scale === 'log') {
		const logLo = Math.log(Math.max(lo, 1e-6));
		const logHi = Math.log(Math.max(hi, 1e-6));
		return (Math.log(Math.max(clamped, 1e-6)) - logLo) / (logHi - logLo);
	}
	return (clamped - lo) / (hi - lo);
}

export function angleFor(next: number, lo: number, hi: number, scale: Scale): number {
	return SWEEP_START_DEG + fractionFor(next, lo, hi, scale) * (SWEEP_END_DEG - SWEEP_START_DEG);
}

/**
 * Vertical pointer drag for the two rotary controls. Blocks the native range's own
 * click-to-position/horizontal-drag so vertical movement is the only thing driving the value while
 * the pointer is down. LinearPot does not use this — its native vertical range already drags
 * correctly on its own via `writing-mode`.
 */
export function startDrag(
	event: PointerEvent,
	startValue: number,
	lo: number,
	hi: number,
	baseStep: number,
	fineStep: number,
	apply: (next: number) => void
): void {
	const input = event.currentTarget as HTMLInputElement;
	event.preventDefault();
	input.focus();
	input.setPointerCapture(event.pointerId);
	const startY = event.clientY;

	function handleMove(moveEvent: PointerEvent) {
		const deltaY = startY - moveEvent.clientY; // drag up increases
		const activeStep = moveEvent.shiftKey ? fineStep : baseStep;
		const steps = Math.round(deltaY / DRAG_PIXELS_PER_STEP);
		apply(clamp(startValue + steps * activeStep, lo, hi));
	}

	function handleUp(upEvent: PointerEvent) {
		input.releasePointerCapture(upEvent.pointerId);
		window.removeEventListener('pointermove', handleMove);
		window.removeEventListener('pointerup', handleUp);
	}

	window.addEventListener('pointermove', handleMove);
	window.addEventListener('pointerup', handleUp);
}

/**
 * Native-range keydown: Shift+Arrow applies the fine step. Arrow (no modifier), Home, End, PageUp,
 * and PageDown are left alone so the native range's built-in keyboard behavior stays complete. This
 * no longer opens the field on Enter — the value-readout button next to the control is a real
 * `<button>`, so it's already reachable and operable (Enter/Space) directly from tab order without
 * the range needing a second, redundant path to the same place.
 */
export function handleRangeKeydown(
	event: KeyboardEvent,
	current: number,
	lo: number,
	hi: number,
	fineStep: number,
	apply: (next: number) => void
): void {
	if (!event.shiftKey) return;
	const direction =
		event.key === 'ArrowUp' || event.key === 'ArrowRight'
			? 1
			: event.key === 'ArrowDown' || event.key === 'ArrowLeft'
				? -1
				: 0;
	if (direction === 0) return;
	event.preventDefault();
	apply(clamp(current + direction * fineStep, lo, hi));
}

/**
 * Validates and commits a typed draft. Empty, non-finite, and out-of-range input sets a linked error
 * and leaves the committed value alone; valid input clears the error, commits, and reformats the
 * draft. Callers decide whether to close the field based on whether `setError` ended up called —
 * an error must keep the field open, or the user never sees why their entry was rejected.
 */
export function commitDraftFor(
	draftValue: string,
	lo: number,
	hi: number,
	current: number,
	decimals: number,
	setError: (message: string) => void,
	setDraft: (next: string) => void,
	apply: (next: number) => void
): void {
	const trimmed = draftValue.trim();
	if (trimmed === '') {
		setError('Enter a value.');
		setDraft(formatValue(current, decimals));
		return;
	}
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed)) {
		setError('Enter a number.');
		setDraft(formatValue(current, decimals));
		return;
	}
	if (parsed < lo || parsed > hi) {
		setError(`Enter a value between ${lo} and ${hi}.`);
		setDraft(formatValue(current, decimals));
		return;
	}
	setError('');
	apply(parsed);
	setDraft(formatValue(parsed, decimals));
}

/** Svelte action: focuses and selects a freshly-revealed field so typing replaces the value at once. */
export function focusAndSelect(node: HTMLInputElement): void {
	node.focus();
	node.select();
}
