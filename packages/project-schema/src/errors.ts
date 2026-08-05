export interface ValidationIssue {
	readonly path: string;
	readonly message: string;
}

export class ProjectValidationError extends Error {
	readonly issues: readonly ValidationIssue[];
	readonly input: unknown;

	constructor(context: string, issues: readonly ValidationIssue[], input: unknown) {
		super(`${context}: ${issues.map((issue) => `${issue.path} ${issue.message}`).join('; ')}.`);
		this.name = 'ProjectValidationError';
		this.issues = issues;
		this.input = input;
	}
}

export class MigrationError extends Error {
	readonly fromVersion: number;
	readonly toVersion: number;
	readonly document: unknown;

	constructor(
		context: string,
		message: string,
		fromVersion: number,
		toVersion: number,
		document: unknown
	) {
		super(`${context}: ${message}`);
		this.name = 'MigrationError';
		this.fromVersion = fromVersion;
		this.toVersion = toVersion;
		this.document = document;
	}
}
