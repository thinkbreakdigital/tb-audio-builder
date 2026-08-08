import { MigrationError } from '../errors.js';

export interface ProjectMigration {
	readonly fromVersion: number;
	readonly toVersion: number;
	migrate(document: Record<string, unknown>): Record<string, unknown>;
}

export interface SoundSetMigration {
	readonly fromVersion: number;
	readonly toVersion: number;
	migrate(document: Record<string, unknown>): Record<string, unknown>;
}

export const PROJECT_MIGRATIONS: readonly ProjectMigration[] = [];
export const SOUND_SET_MIGRATIONS: readonly SoundSetMigration[] = [];

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

export function runMigrationPipeline(
	document: unknown,
	context: string,
	targetVersion: number,
	migrations: readonly ProjectMigration[]
): Record<string, unknown> {
	if (!isPlainObject(document) || typeof document.schemaVersion !== 'number') {
		throw new MigrationError(
			context,
			'document must be a plain object with a numeric schemaVersion.',
			-1,
			targetVersion,
			document
		);
	}

	const originalVersion = document.schemaVersion;
	if (originalVersion > targetVersion) {
		throw new MigrationError(
			context,
			`document schema version ${originalVersion} was written by a newer Builder version; this Builder supports version ${targetVersion}.`,
			originalVersion,
			targetVersion,
			document
		);
	}

	let currentVersion = originalVersion;
	let currentDocument = structuredClone(document);
	while (currentVersion < targetVersion) {
		const migration = [...migrations]
			.sort((left, right) => left.fromVersion - right.fromVersion)
			.find(({ fromVersion }) => fromVersion === currentVersion);
		if (migration === undefined || migration.toVersion !== currentVersion + 1) {
			throw new MigrationError(
				context,
				`missing migration step ${currentVersion}→${currentVersion + 1}.`,
				currentVersion,
				currentVersion + 1,
				document
			);
		}

		const migrated = migration.migrate(structuredClone(currentDocument));
		if (!isPlainObject(migrated)) {
			throw new MigrationError(
				context,
				`migration step ${currentVersion}→${migration.toVersion} did not return a plain object.`,
				currentVersion,
				migration.toVersion,
				document
			);
		}
		currentVersion = migration.toVersion;
		currentDocument = { ...migrated, schemaVersion: currentVersion };
	}

	return currentDocument;
}
