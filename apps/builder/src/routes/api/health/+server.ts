import { checkDatabaseConnection } from '$lib/server/database/health';
import { json } from '@sveltejs/kit';

const headers = {
	'cache-control': 'no-store'
};

export async function GET() {
	try {
		await checkDatabaseConnection();
		return json({ status: 'ok', database: 'connected' }, { headers });
	} catch (error) {
		console.error('Builder health check could not connect to PostgreSQL.', error);
		return json({ status: 'error', database: 'unavailable' }, { status: 503, headers });
	}
}
