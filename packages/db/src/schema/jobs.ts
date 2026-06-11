import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects';

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  type: varchar('type', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  payload: jsonb('payload'),
  result: jsonb('result'),
  error: varchar('error'),
  temporalWorkflowId: varchar('temporal_workflow_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('jobs_project_id_idx').on(table.projectId),
  index('jobs_type_status_idx').on(table.type, table.status),
]);
