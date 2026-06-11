import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';

const connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/clipper';

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { client };
