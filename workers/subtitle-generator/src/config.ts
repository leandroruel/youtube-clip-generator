import 'dotenv/config';

export const config = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/clipper',
  NATS_URL: process.env.NATS_URL ?? 'nats://localhost:4222',
  GARAGE_ENDPOINT: process.env.GARAGE_ENDPOINT ?? 'http://localhost:3900',
  GARAGE_REGION: process.env.GARAGE_REGION ?? 'garage',
  GARAGE_ACCESS_KEY: process.env.GARAGE_ACCESS_KEY ?? 'admin',
  GARAGE_SECRET_KEY: process.env.GARAGE_SECRET_KEY ?? 'admin',
  GARAGE_BUCKET: process.env.GARAGE_BUCKET ?? 'clipper',
  DOWNLOAD_DIR: process.env.DOWNLOAD_DIR ?? '/tmp/clipper-subtitles',
  FONT_FILE: process.env.FONT_FILE ?? '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  SUBTITLE_POSITION: process.env.SUBTITLE_POSITION ?? 'bottom',
} as const;
