import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { clips } from './clips';

export const renders = pgTable('renders', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  clipId: uuid('clip_id').references(() => clips.id),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  config: jsonb('config'),
  outputPath: varchar('output_path', { length: 512 }),
  format: varchar('format', { length: 50 }).notNull().default('mp4'),
  resolution: varchar('resolution', { length: 20 }).notNull().default('1080x1920'),
  error: varchar('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('renders_project_id_idx').on(table.projectId),
  index('renders_clip_id_idx').on(table.clipId),
]);
