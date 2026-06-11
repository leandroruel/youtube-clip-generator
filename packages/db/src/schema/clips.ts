import { pgTable, uuid, varchar, jsonb, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { videos } from './videos';
import { projects } from './projects';

export const clips = pgTable('clips', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  videoId: uuid('video_id').notNull().references(() => videos.id),
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time').notNull(),
  text: varchar('text'),
  viralScore: jsonb('viral_score'),
  cropParams: jsonb('crop_params'),
  rank: integer('rank'),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  outputPath: varchar('output_path', { length: 512 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('clips_project_id_idx').on(table.projectId),
  index('clips_video_id_idx').on(table.videoId),
]);
