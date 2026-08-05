import { describe, expect, test } from 'vitest';
import {
	MigrationError,
	ProjectValidationError,
	createEmptyProject,
	migrateProjectDocument,
	runMigrationPipeline,
	type ProjectMigration
} from '../src';

describe('project migrations', () => {
	test('current documents pass through validated', () => {
		const project = createEmptyProject({ name: 'Current' });
		expect(migrateProjectDocument(project, 'Loading current project')).toEqual(project);
	});

	test('fixture migrations upgrade in order without mutating input', () => {
		const input = { schemaVersion: 1, original: true };
		const migrations: readonly ProjectMigration[] = [
			{
				fromVersion: 1,
				toVersion: 2,
				migrate: (document) => ({ ...document, second: true })
			},
			{
				fromVersion: 2,
				toVersion: 3,
				migrate: (document) => ({ ...document, third: true })
			}
		];
		expect(runMigrationPipeline(input, 'Fixture', 3, migrations)).toEqual({
			schemaVersion: 3,
			original: true,
			second: true,
			third: true
		});
		expect(input).toEqual({ schemaVersion: 1, original: true });
	});

	test('newer documents throw with both versions', () => {
		expect(() => migrateProjectDocument({ schemaVersion: 2 }, 'Loading project')).toThrow(
			MigrationError
		);
		try {
			migrateProjectDocument({ schemaVersion: 2 }, 'Loading project');
		} catch (error) {
			expect((error as Error).message).toContain('2');
			expect((error as Error).message).toContain('1');
		}
	});

	test('migration gaps name the missing step', () => {
		expect(() => runMigrationPipeline({ schemaVersion: 1 }, 'Fixture', 3, [])).toThrow('1→2');
	});

	test('post-migration validation errors retain the original input', () => {
		const invalid = { schemaVersion: 1, name: '' };
		try {
			migrateProjectDocument(invalid, 'Loading invalid project');
		} catch (error) {
			expect(error).toBeInstanceOf(ProjectValidationError);
			expect((error as ProjectValidationError).input).toBe(invalid);
		}
	});
});
