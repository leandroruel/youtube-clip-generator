import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import pino from 'pino';

const logger = pino({ name: 'migrate', level: 'info' });

const connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/clipper';

const migrationClient = postgres(connectionString, { max: 1 });

async function main() {
  const db = drizzle(migrationClient);

  logger.info('Running migrations');
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  logger.info('Migrations applied successfully');

  await migrationClient.end();
}

main().catch((err) => {
  logger.fatal(err, 'Migration failed');
  process.exit(1);
});
