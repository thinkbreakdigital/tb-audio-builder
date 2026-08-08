import type { ZodType } from 'zod';
import { ProjectValidationError } from './errors.js';

export function parseOrThrow<T>(schema: ZodType<T>, value: unknown, context: string): T {
	const result = schema.safeParse(value);
	if (result.success) return result.data;

	throw new ProjectValidationError(
		context,
		result.error.issues.map((issue) => ({
			path: issue.path.map(String).join('.'),
			message: issue.message
		})),
		value
	);
}

export function parseSafe<T>(
	schema: ZodType<T>,
	value: unknown,
	context: string
): { ok: true; value: T } | { ok: false; error: ProjectValidationError } {
	try {
		return { ok: true, value: parseOrThrow(schema, value, context) };
	} catch (error) {
		if (error instanceof ProjectValidationError) return { ok: false, error };
		throw error;
	}
}
