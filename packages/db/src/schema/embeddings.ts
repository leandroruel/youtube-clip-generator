import { pgTable, uuid, varchar, vector, timestamp, index } from 'drizzle-orm/pg-core';
import { clips } from './clips.js';
import { transcripts } from './transcripts.js';

export const embeddings = pgTable('embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  transcriptId: uuid('transcript_id').notNull().references(() => transcripts.id),
  clipId: uuid('clip_id').references(() => clips.id),
  text: varchar('text').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  model: varchar('model', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('embeddings_transcript_id_idx').on(table.transcriptId),
  index('embeddings_clip_id_idx').on(table.clipId),
]);
