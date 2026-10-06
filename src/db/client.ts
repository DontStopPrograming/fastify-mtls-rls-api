import { Pool } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({ connectionString: env.DATABASE_URL });

export async function withUser<T>(
    userId: string,
    fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            "SELECT set_config('request.jwt.claims', $1, true)",
            [JSON.stringify({ sub: userId, role: 'authenticated' })]
        );
        await client.query("SELECT set_config('role', $1, true)", ['authenticated']);
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err){
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}