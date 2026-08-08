/**
 * Exhaustiveness guard for `switch` over union types. Reaching it means a variant was added
 * without a matching branch, so it throws rather than silently falling through.
 */
export function assertNever(value: never, context: string): never {
	throw new Error(`Unhandled variant in ${context}: ${JSON.stringify(value)}.`);
}
