import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

let pool: Pool | undefined;

function getPool(): Pool {
	if (pool) return pool;

	const databaseUrl = env.DATABASE_URL?.trim();
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is not configured for the Builder server.');
	}

	pool = new Pool({
		connectionString: databaseUrl,
		connectionTimeoutMillis: 5_000,
		idleTimeoutMillis: 30_000,
		max: 10
	});

	pool.on('error', (error) => {
		console.error('Unexpected idle PostgreSQL client error.', error);
	});

	return pool;
}

export function getDatabase() {
	return drizzle({ client: getPool(), schema });
}
