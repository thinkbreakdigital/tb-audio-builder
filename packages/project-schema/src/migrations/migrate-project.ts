import type { BuilderProject } from '@thinkbreak/audio-runtime';
import { ProjectValidationError } from '../errors.js';
import { parseOrThrow } from '../parse.js';
import { BuilderProjectSchema } from '../schemas/index.js';
import { PROJECT_MIGRATIONS, runMigrationPipeline } from './registry.js';

export function migrateProjectDocument(document: unknown, context: string): BuilderProject {
	const migrated = runMigrationPipeline(document, context, 1, PROJECT_MIGRATIONS);
	try {
		return parseOrThrow(BuilderProjectSchema, migrated, context);
	} catch (error) {
		if (error instanceof ProjectValidationError) {
			throw new ProjectValidationError(context, error.issues, document);
		}
		throw error;
	}
}
