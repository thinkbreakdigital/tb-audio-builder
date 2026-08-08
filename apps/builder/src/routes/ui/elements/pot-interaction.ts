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
   pixel rate, which is what makes the fine drag read as more precise rather than just slower. Used
   by both the linear and log-domain drags, so the two feel the same even though a "step" means a
   fixed Hz amount in one and a fixed cents amount in the other. */
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
 * Cents-domain stepping for scale:'log' (frequency-like) parameters. A step here must be a constant
 * musical interval — multiply, don't add — or a step is a barely-audible fraction of a semitone at
 * the top of a range and a near-semitone jump at the bottom, where the ear is most sensitive. This
 * is exactly why scale:'log' is only ever valid for a parameter whose range cannot reach 0 (e.g. not
 * vibrato rate, 0-20Hz): stepByCents is pure multiplication, so it can never itself produce NaN or
 * Infinity, but a value that starts at 0 stays at 0 forever (0 times any ratio is 0) — the "cannot
 * be multiplied into anything else" problem is prevented architecturally, by never routing a
 * scale:'linear' parameter through this code, not by a runtime guard in the maths below.
 */
const CENTS_PER_OCTAVE = 1200;

/** One semitone: the plain Arrow-key step for a log-scale range. */
export const LOG_STEP_CENTS = 100;
/** A tenth of a semitone: the Shift+Arrow fine step. */
export const LOG_FINE_STEP_CENTS = 10;
/** One octave: the PageUp/PageDown step. */
export const LOG_PAGE_STEP_CENTS = CENTS_PER_OCTAVE;

/** Multiplies `value` by the ratio equal to `cents` — the log-domain move that keeps a step's
    perceived size constant across the whole range, unlike adding a fixed number of Hz. */
export function stepByCents(value: number, cents: number): number {
	return value * Math.pow(2, cents / CENTS_PER_OCTAVE);
}

/**
 * Keydown handling for a scale:'linear' range: Shift+Arrow applies the fine step. Arrow (no
 * modifier), Home, End, PageUp, and PageDown are left alone so the native range's built-in keyboard
 * behavior stays complete. This no longer opens the field on Enter — the value-readout button next
 * to the control is a real `<button>`, so it's already reachable and operable (Enter/Space) directly
 * from tab order without the range needing a second, redundant path to the same place.
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
 * Keydown handling for a scale:'log' range: Arrow keys move one semitone, Shift+Arrow moves ten
 * cents, PageUp/PageDown move a full octave — all multiplicative (see stepByCents), and all
 * intercepted rather than left to the native range's step attribute. The native range underneath a
 * log-scale control still holds its value in real Hz (see startLogDrag below for why), and native
 * stepping only knows how to add a fixed amount — never multiply — so every key that should move a
 * musical interval has to be handled here. Home and End are left alone: the range's own min/max are
 * already the real Hz bounds, so native Home/End already land in the right place.
 */
export function handleLogRangeKeydown(
	event: KeyboardEvent,
	current: number,
	lo: number,
	hi: number,
	apply: (next: number) => void
): void {
	const isPage = event.key === 'PageUp' || event.key === 'PageDown';
	const direction =
		event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'PageUp'
			? 1
			: event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'PageDown'
				? -1
				: 0;
	if (direction === 0) return;
	const cents = isPage
		? LOG_PAGE_STEP_CENTS
		: event.shiftKey
			? LOG_FINE_STEP_CENTS
			: LOG_STEP_CENTS;
	event.preventDefault();
	apply(clamp(stepByCents(current, direction * cents), lo, hi));
}

/**
 * Shared pointer-drag lifecycle for every vertical drag control (the rotary dial/ring/disc, and the
 * linear fader): blocks the native range's own click-to-position via preventDefault so a press alone
 * never moves the value, only movement does; captures the pointer; and — critically — treats
 * pointercancel exactly like pointerup except it restores `startValue` instead of wherever the drag
 * happened to be (09B §4.2: pointer cancellation restores the last committed value, it doesn't
 * strand the control mid-drag). One teardown function runs on both pointerup and pointercancel so
 * the two listeners can never diverge or leak. `computeNext` supplies the actual value math — linear
 * add for startDrag, cents-domain multiply for startLogDrag — so this lifecycle exists exactly once.
 */
function runVerticalDrag(
	event: PointerEvent,
	startValue: number,
	apply: (next: number) => void,
	computeNext: (deltaY: number, shiftKey: boolean) => number
): void {
	const input = event.currentTarget as HTMLInputElement;
	event.preventDefault();
	input.focus();
	input.setPointerCapture(event.pointerId);
	const startY = event.clientY;

	function handleMove(moveEvent: PointerEvent) {
		apply(computeNext(startY - moveEvent.clientY, moveEvent.shiftKey));
	}

	function teardown(pointerId: number) {
		input.releasePointerCapture(pointerId);
		window.removeEventListener('pointermove', handleMove);
		window.removeEventListener('pointerup', handleUp);
		window.removeEventListener('pointercancel', handleCancel);
	}

	function handleUp(upEvent: PointerEvent) {
		teardown(upEvent.pointerId);
	}

	function handleCancel(cancelEvent: PointerEvent) {
		teardown(cancelEvent.pointerId);
		apply(startValue);
	}

	window.addEventListener('pointermove', handleMove);
	window.addEventListener('pointerup', handleUp);
	window.addEventListener('pointercancel', handleCancel);
}

/**
 * Vertical pointer drag for a scale:'linear' control. LinearPot uses this too (not a copy): the math
 * was never actually rotary-specific, just a vertical pixel delta, so the fader shares it directly
 * instead of falling back to the native range's own (jump-to-position) dragging.
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
	runVerticalDrag(event, startValue, apply, (deltaY, shiftKey) => {
		const activeStep = shiftKey ? fineStep : baseStep;
		const steps = Math.round(deltaY / DRAG_PIXELS_PER_STEP);
		return clamp(startValue + steps * activeStep, lo, hi);
	});
}

/**
 * Vertical pointer drag for a scale:'log' control: a given pixel distance moves a constant number of
 * cents anywhere in the range (the drag equivalent of handleLogRangeKeydown), not a constant number
 * of Hz. Same DRAG_PIXELS_PER_STEP feel, same pointercancel-safe lifecycle as startDrag — only the
 * domain of what one step means differs.
 */
export function startLogDrag(
	event: PointerEvent,
	startValue: number,
	lo: number,
	hi: number,
	apply: (next: number) => void
): void {
	runVerticalDrag(event, startValue, apply, (deltaY, shiftKey) => {
		const centsPerStep = shiftKey ? LOG_FINE_STEP_CENTS : LOG_STEP_CENTS;
		const steps = Math.round(deltaY / DRAG_PIXELS_PER_STEP);
		return clamp(stepByCents(startValue, steps * centsPerStep), lo, hi);
	});
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
