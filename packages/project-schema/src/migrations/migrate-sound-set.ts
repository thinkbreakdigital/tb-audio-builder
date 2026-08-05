import { ProjectValidationError } from '../errors';
import { parseOrThrow } from '../parse';
import { SoundSetSchema, type SoundSet } from '../schemas';
import { runMigrationPipeline, SOUND_SET_MIGRATIONS } from './registry';

export function migrateSoundSetDocument(document: unknown, context: string): SoundSet {
	const migrated = runMigrationPipeline(document, context, 1, SOUND_SET_MIGRATIONS);
	try {
		return parseOrThrow(SoundSetSchema, migrated, context);
	} catch (error) {
		if (error instanceof ProjectValidationError) {
			throw new ProjectValidationError(context, error.issues, document);
		}
		throw error;
	}
}
