import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { fileURLToPath } from 'node:url';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		'DATABASE_URL is required. Copy .example.env to .env before running database commands.'
	);
}

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/server/database/schema.ts',
	out: './drizzle',
	dbCredentials: {
		url: databaseUrl
	},
	strict: true,
	verbose: true
});
