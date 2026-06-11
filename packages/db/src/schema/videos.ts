import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const videos = pgTable('videos', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  title: varchar('title', { length: 255 }).notNull(),
  source: varchar('source', { length: 50 }).notNull(),
  sourceUrl: varchar('source_url', { length: 1024 }),
  duration: integer('duration'),
  originalPath: varchar('original_path', { length: 512 }),
  proxyPath: varchar('proxy_path', { length: 512 }),
  audioPath: varchar('audio_path', { length: 512 }),
  thumbnailPath: varchar('thumbnail_path', { length: 512 }),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('videos_project_id_idx').on(table.projectId),
]);
