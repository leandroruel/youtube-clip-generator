import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('created'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('projects_user_id_idx').on(table.userId),
]);
