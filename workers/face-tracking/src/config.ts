import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export const config = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/clipper',
  NATS_URL: process.env.NATS_URL ?? 'nats://localhost:4222',
  GARAGE_ENDPOINT: process.env.GARAGE_ENDPOINT ?? 'http://localhost:3900',
  GARAGE_REGION: process.env.GARAGE_REGION ?? 'garage',
  GARAGE_ACCESS_KEY: process.env.GARAGE_ACCESS_KEY ?? 'admin',
  GARAGE_SECRET_KEY: process.env.GARAGE_SECRET_KEY ?? 'admin',
  GARAGE_BUCKET: process.env.GARAGE_BUCKET ?? 'clipper',
  DOWNLOAD_DIR: process.env.DOWNLOAD_DIR ?? '/tmp/clipper-faces',
  OUTPUT_WIDTH: Number(process.env.OUTPUT_WIDTH ?? '608'),
  OUTPUT_HEIGHT: Number(process.env.OUTPUT_HEIGHT ?? '1080'),
} as const;
