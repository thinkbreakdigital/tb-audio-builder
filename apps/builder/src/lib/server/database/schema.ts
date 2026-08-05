import { sql } from 'drizzle-orm';
import {
	check,
	customType,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({
	dataType() {
		return 'bytea';
	}
});

export const projects = pgTable(
	'projects',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		name: text('name').notNull(),
		accessTokenHash: text('access_token_hash').notNull(),
		schemaVersion: integer('schema_version').notNull(),
		revision: integer('revision').default(1).notNull(),
		projectDocument: jsonb('project_document').$type<unknown>().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('projects_access_token_hash_idx').on(table.accessTokenHash),
		index('projects_updated_at_idx').on(table.updatedAt),
		check('projects_schema_version_positive', sql`${table.schemaVersion} > 0`),
		check('projects_revision_positive', sql`${table.revision} > 0`)
	]
);

export const projectFiles = pgTable(
	'project_files',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		filename: text('filename').notNull(),
		mimeType: text('mime_type').notNull(),
		fileData: bytea('file_data').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [index('project_files_project_id_idx').on(table.projectId)]
);

export const instrumentPresets = pgTable(
	'instrument_presets',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		name: text('name').notNull(),
		presetType: text('preset_type').notNull(),
		presetDocument: jsonb('preset_document').$type<unknown>().notNull(),
		accessTokenHash: text('access_token_hash').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('instrument_presets_access_token_hash_idx').on(table.accessTokenHash),
		index('instrument_presets_updated_at_idx').on(table.updatedAt)
	]
);

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type ProjectFileRow = typeof projectFiles.$inferSelect;
export type NewProjectFileRow = typeof projectFiles.$inferInsert;
export type InstrumentPresetRow = typeof instrumentPresets.$inferSelect;
export type NewInstrumentPresetRow = typeof instrumentPresets.$inferInsert;
