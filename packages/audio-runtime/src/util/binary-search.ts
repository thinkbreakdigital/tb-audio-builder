/**
 * Binary searches over arrays sorted ascending by a numeric key.
 *
 * `keyOf` is passed explicitly rather than captured so callers can hoist it to module scope and
 * keep these searches allocation-free on the playback path.
 */

export type NumericKeyOf<T> = (item: T) => number;

/**
 * Index of the last item whose key is `<= key`, or `-1` when every item sorts after it.
 */
export function findLastIndexAtOrBefore<T>(
	items: readonly T[],
	key: number,
	keyOf: NumericKeyOf<T>
): number {
	let low = 0;
	let high = items.length - 1;
	let result = -1;
	while (low <= high) {
		const mid = (low + high) >> 1;
		const item = items[mid] as T;
		if (keyOf(item) <= key) {
			result = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	return result;
}

/**
 * Index of the first item whose key is `>= key`, or `items.length` when none qualifies.
 */
export function findFirstIndexAtOrAfter<T>(
	items: readonly T[],
	key: number,
	keyOf: NumericKeyOf<T>
): number {
	let low = 0;
	let high = items.length;
	while (low < high) {
		const mid = (low + high) >> 1;
		const item = items[mid] as T;
		if (keyOf(item) < key) {
			low = mid + 1;
		} else {
			high = mid;
		}
	}
	return low;
}
