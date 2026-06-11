import 'dotenv/config';

export const config = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/clipper',
  NATS_URL: process.env.NATS_URL ?? 'nats://localhost:4222',
  MAX_CLIP_DURATION: Number(process.env.MAX_CLIP_DURATION ?? '60'),
  MIN_CLIP_DURATION: Number(process.env.MIN_CLIP_DURATION ?? '15'),
  MAX_CLIPS: Number(process.env.MAX_CLIPS ?? '10'),
  MIN_VIRAL_SCORE: Number(process.env.MIN_VIRAL_SCORE ?? '0.3'),
} as const;
