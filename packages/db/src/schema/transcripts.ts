import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { videos } from './videos.js';

export const transcripts = pgTable('transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  videoId: uuid('video_id').notNull().references(() => videos.id),
  fullText: varchar('full_text'),
  segments: jsonb('segments').notNull(),
  model: varchar('model', { length: 100 }).notNull().default('whisper-large-v3'),
  language: varchar('language', { length: 10 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('transcripts_video_id_idx').on(table.videoId),
]);
