import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/clipper';

const migrationClient = postgres(connectionString, { max: 1 });

async function main() {
  const db = drizzle(migrationClient);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('Migrations applied successfully');

  await migrationClient.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
