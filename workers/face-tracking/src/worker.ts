import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { type NatsConnection, consumerOpts } from 'nats';
import { createNatsConnection, ensureJobStream, subjectForJobType } from '@clipper/queue';
import { createS3Client, ensureBucket, getObject } from '@clipper/storage';
import { jobs, clips, videos } from '@clipper/db/schema';
import { JobStatus, JobType } from '@clipper/shared';
import type { Logger } from '@clipper/logger';
import { config } from './config.js';
import { detectCrop, cleanupFile, type CropParams } from './detector.js';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

export interface NatsMsg {
  ack: () => void;
  term: (reason?: string) => void;
  data: Uint8Array;
}

export interface FaceTrackingPayload {
  jobId: string;
  projectId: string;
  clipId: string;
}

export type DB = ReturnType<typeof drizzle>;
export type S3 = ReturnType<typeof createS3Client>['client'];

export async function startWorker(nc: NatsConnection, logger: Logger) {
  const sql = postgres(config.DATABASE_URL, { prepare: false });
  const db = drizzle(sql, { schema: { jobs, clips, videos } });

  const s3Config = {
    endpoint: config.GARAGE_ENDPOINT,
    region: config.GARAGE_REGION,
    accessKeyId: config.GARAGE_ACCESS_KEY,
    secretAccessKey: config.GARAGE_SECRET_KEY,
    bucket: config.GARAGE_BUCKET,
  };

  const { client: s3, bucket } = createS3Client(s3Config);
  await ensureBucket(s3, bucket);

  await ensureJobStream(nc);
  const js = nc.jetstream();

  const opts = consumerOpts();
  opts.durable('face-tracking');
  opts.manualAck();
  opts.ackExplicit();
  opts.maxDeliver(3);
  opts.ackWait(300_000);

  const subject = subjectForJobType(JobType.FACE_TRACKING);
  const sub = await js.pullSubscribe(subject, opts);

  logger.info({ subject }, 'Listening for face tracking jobs');

  const pullNext = () => { sub.pull({ batch: 1 }); };
  pullNext();

  for await (const msg of sub as unknown as AsyncIterable<NatsMsg>) {
    try {
      await handleMessage(msg, db, s3, bucket, logger);
    } catch (err) {
      logger.error(err, 'Failed to process message');
    }
    pullNext();
  }
}

export async function handleMessage(
  msg: NatsMsg,
  db: DB,
  s3: S3,
  bucket: string,
  logger: Logger,
) {
  const payload: FaceTrackingPayload = JSON.parse(new TextDecoder().decode(msg.data));
  logger.info({ clipId: payload.clipId }, 'Processing face tracking');

  await db.update(jobs)
    .set({ status: JobStatus.PROCESSING, updatedAt: new Date() })
    .where(eq(jobs.id, payload.jobId));

  let videoPath: string | null = null;

  try {
    const [clip] = await db.select()
      .from(clips)
      .where(eq(clips.id, payload.clipId));

    if (!clip) throw new Error('Clip not found');

    const [video] = await db.select()
      .from(videos)
      .where(eq(videos.id, clip.videoId));

    if (!video || !video.originalPath) throw new Error('Video not found or no original path');

    videoPath = `${config.DOWNLOAD_DIR}/${payload.clipId}.mp4`;

    const response = await getObject(s3, bucket, video.originalPath);
    const bodyStream = response.Body as NodeJS.ReadableStream;
    if (!bodyStream) throw new Error('Empty response body from S3');

    await pipeline(bodyStream, createWriteStream(videoPath));

    const crop: CropParams = detectCrop(videoPath, config.OUTPUT_WIDTH, config.OUTPUT_HEIGHT);

    await db.update(clips)
      .set({
        cropParams: crop as unknown as Record<string, unknown>,
        status: 'framed',
        updatedAt: new Date(),
      })
      .where(eq(clips.id, payload.clipId));

    await db.update(jobs)
      .set({
        status: JobStatus.COMPLETED,
        result: crop as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, payload.jobId));

    msg.ack();

    logger.info({ clipId: payload.clipId, crop }, 'Face tracking complete');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db.update(jobs)
      .set({ status: JobStatus.FAILED, error: errorMessage, updatedAt: new Date() })
      .where(eq(jobs.id, payload.jobId));

    msg.term();

    logger.error({ error: errorMessage }, 'Face tracking failed');
  } finally {
    if (videoPath) cleanupFile(videoPath);
  }
}
