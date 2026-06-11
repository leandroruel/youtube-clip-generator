import 'dotenv/config';

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  HOST: process.env.HOST ?? '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/clipper',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  GARAGE_ENDPOINT: process.env.GARAGE_ENDPOINT ?? 'http://localhost:3900',
  GARAGE_REGION: process.env.GARAGE_REGION ?? 'garage',
  GARAGE_ACCESS_KEY: process.env.GARAGE_ACCESS_KEY ?? 'admin',
  GARAGE_SECRET_KEY: process.env.GARAGE_SECRET_KEY ?? 'admin',
  GARAGE_BUCKET: process.env.GARAGE_BUCKET ?? 'clipper',
  NATS_URL: process.env.NATS_URL ?? 'nats://localhost:4222',
  TEMPORAL_HOST: process.env.TEMPORAL_HOST ?? 'localhost:7233',
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
} as const;
