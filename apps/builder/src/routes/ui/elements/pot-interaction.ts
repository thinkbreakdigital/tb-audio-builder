/**
 * Shared interaction logic for the pot family — RotaryPot, DualRotaryPot, LinearPot. Pure functions,
 * one small stateful factory (`createClickInteraction`), and one Svelte action; no component $state
 * lives here. Each component keeps its own reactive state (value, draft, error, fieldOpen) and
 * passes read/write callbacks in, so the drag feel, the fine-step behavior, the click/double-click
 * gesture, and the field-reveal/validation rules are identical across all three without forcing them
 * to share a single rendered component.
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

/* Pointer movement, in px, below which a press-release counts as a click (opens the field) rather
   than a drag (changes the value). */
export const CLICK_DRAG_THRESHOLD_PX = 3;

/* How long a qualifying click waits before it actually opens the field. A second click arriving
   inside this window is the first click of a double-click, so it cancels the pending open instead
   of letting the field flash open a moment before the double-click resets the value. */
export const DOUBLE_CLICK_WINDOW_MS = 250;

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
 * correctly on its own via `writing-mode`, so it only needs `trackClickVsDrag` below.
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
 * Classifies a press-release as a click (fires `onClick`) or a drag (does nothing here — the drag
 * itself, native or `startDrag`, already ran off the same pointerdown). Runs independently of
 * `startDrag` so it works whether the control drags itself manually (RotaryPot, DualRotaryPot) or
 * lets the native input handle dragging (LinearPot). Internal to `createClickInteraction` below,
 * which is what components actually wire up — it adds the double-click guard this alone can't.
 */
function trackClickVsDrag(event: PointerEvent, onClick: () => void): void {
	const startX = event.clientX;
	const startY = event.clientY;
	let moved = false;

	function handleMove(moveEvent: PointerEvent) {
		const dx = moveEvent.clientX - startX;
		const dy = moveEvent.clientY - startY;
		if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD_PX) moved = true;
	}

	function handleUp() {
		window.removeEventListener('pointermove', handleMove);
		window.removeEventListener('pointerup', handleUp);
		if (!moved) onClick();
	}

	window.addEventListener('pointermove', handleMove);
	window.addEventListener('pointerup', handleUp);
}

export interface ClickInteraction {
	onPointerDown: (event: PointerEvent) => void;
	onDoubleClick: () => void;
}

/**
 * Owns the click / drag / double-click gesture for one control. A qualifying click (see
 * `trackClickVsDrag`) doesn't open the field immediately — it schedules `openField` after
 * `DOUBLE_CLICK_WINDOW_MS`. A genuine `dblclick` arriving before that timer fires cancels the
 * pending open and runs `reset` instead, so a double-click resets the value without ever flashing
 * the field open on the way there. Each call owns its own pending-timer state, so RotaryPot and
 * LinearPot call this once and DualRotaryPot calls it once per ring.
 */
export function createClickInteraction(openField: () => void, reset: () => void): ClickInteraction {
	let pendingOpen: ReturnType<typeof setTimeout> | undefined;

	function cancelPendingOpen() {
		if (pendingOpen !== undefined) {
			clearTimeout(pendingOpen);
			pendingOpen = undefined;
		}
	}

	function onPointerDown(event: PointerEvent) {
		trackClickVsDrag(event, () => {
			cancelPendingOpen();
			pendingOpen = setTimeout(() => {
				pendingOpen = undefined;
				openField();
			}, DOUBLE_CLICK_WINDOW_MS);
		});
	}

	function onDoubleClick() {
		cancelPendingOpen();
		reset();
	}

	return { onPointerDown, onDoubleClick };
}

/**
 * Native-range keydown: Enter opens the field (the keyboard-only path to fine-tune entry — see
 * module docs), Shift+Arrow applies the fine step. Arrow (no modifier), Home, End, PageUp, and
 * PageDown are left alone so the native range's built-in keyboard behavior stays complete without
 * ever opening the field.
 */
export function handleRangeKeydown(
	event: KeyboardEvent,
	current: number,
	lo: number,
	hi: number,
	fineStep: number,
	apply: (next: number) => void,
	openField: () => void
): void {
	if (event.key === 'Enter') {
		event.preventDefault();
		openField();
		return;
	}
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
