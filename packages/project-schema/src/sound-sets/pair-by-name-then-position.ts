function normalizeName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, '');
}

/** Generic pairing used by both sound-set apply and MIDI replacement. */
export function pairByNameThenPosition<L extends { name: string }, R extends { name: string }>(
	left: readonly L[],
	right: readonly R[]
): {
	pairs: { left: L; right: R }[];
	unmatchedLeft: L[];
	unmatchedRight: R[];
} {
	const pairs: { left: L; right: R }[] = [];
	const consumedLeft = new Set<number>();
	const consumedRight = new Set<number>();

	left.forEach((leftItem, leftIndex) => {
		const normalizedLeftName = normalizeName(leftItem.name);
		const rightIndex = right.findIndex(
			(rightItem, index) =>
				!consumedRight.has(index) && normalizeName(rightItem.name) === normalizedLeftName
		);
		if (rightIndex < 0) return;
		const rightItem = right[rightIndex];
		if (rightItem === undefined) return;
		pairs.push({ left: leftItem, right: rightItem });
		consumedLeft.add(leftIndex);
		consumedRight.add(rightIndex);
	});

	const remainingLeft = left.filter((_, index) => !consumedLeft.has(index));
	const remainingRight = right.filter((_, index) => !consumedRight.has(index));
	const positionalPairCount = Math.min(remainingLeft.length, remainingRight.length);
	for (let index = 0; index < positionalPairCount; index += 1) {
		const leftItem = remainingLeft[index];
		const rightItem = remainingRight[index];
		if (leftItem !== undefined && rightItem !== undefined)
			pairs.push({ left: leftItem, right: rightItem });
	}

	return {
		pairs,
		unmatchedLeft: remainingLeft.slice(positionalPairCount),
		unmatchedRight: remainingRight.slice(positionalPairCount)
	};
}
