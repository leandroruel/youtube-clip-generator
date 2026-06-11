import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { type NatsConnection, consumerOpts } from 'nats';
import { createNatsConnection, ensureJobStream, subjectForJobType } from '@clipper/queue';
import { createS3Client, ensureBucket, getObject, uploadStream } from '@clipper/storage';
import { jobs, clips, videos } from '@clipper/db/schema';
import { JobStatus, JobType } from '@clipper/shared';
import type { Logger } from '@clipper/logger';
import { config } from './config.js';
import { renderClip, cleanupFile, type CropParams, type RenderResult } from './renderer.js';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

export interface NatsMsg {
  ack: () => void;
  term: (reason?: string) => void;
  data: Uint8Array;
}

export interface RenderPayload {
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
  opts.durable('renderer');
  opts.manualAck();
  opts.ackExplicit();
  opts.maxDeliver(3);
  opts.ackWait(600_000);

  const subject = subjectForJobType(JobType.RENDER);
  const sub = await js.pullSubscribe(subject, opts);

  logger.info({ subject }, 'Listening for render jobs');

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
  const payload: RenderPayload = JSON.parse(new TextDecoder().decode(msg.data));
  logger.info({ clipId: payload.clipId }, 'Processing render');

  await db.update(jobs)
    .set({ status: JobStatus.PROCESSING, updatedAt: new Date() })
    .where(eq(jobs.id, payload.jobId));

  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    const [clip] = await db.select()
      .from(clips)
      .where(eq(clips.id, payload.clipId));

    if (!clip) throw new Error('Clip not found');

    const [video] = await db.select()
      .from(videos)
      .where(eq(videos.id, clip.videoId));

    if (!video || !video.originalPath) throw new Error('Video not found or no original path');

    inputPath = `${config.DOWNLOAD_DIR}/${payload.clipId}-input.mp4`;
    outputPath = `${config.DOWNLOAD_DIR}/${payload.clipId}-final.mp4`;

    const response = await getObject(s3, bucket, video.originalPath);
    const bodyStream = response.Body as NodeJS.ReadableStream;
    if (!bodyStream) throw new Error('Empty response body from S3');

    await pipeline(bodyStream, createWriteStream(inputPath));

    const duration = clip.endTime - clip.startTime;
    const crop = clip.cropParams as unknown as CropParams | null;

    const result: RenderResult = renderClip(inputPath, outputPath, clip.startTime, duration, crop ?? undefined);

    const outputKey = `clips/${payload.clipId}/final.mp4`;
    await uploadStream(s3, bucket, outputKey, createReadStream(result.outputPath), 'video/mp4');

    await db.update(clips)
      .set({
        status: 'completed',
        outputPath: outputKey,
        updatedAt: new Date(),
      })
      .where(eq(clips.id, payload.clipId));

    await db.update(jobs)
      .set({
        status: JobStatus.COMPLETED,
        result: { outputKey, duration: result.duration, fileSize: result.fileSize } as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, payload.jobId));

    msg.ack();

    logger.info({ clipId: payload.clipId, duration: result.duration, fileSize: result.fileSize }, 'Render complete');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db.update(jobs)
      .set({ status: JobStatus.FAILED, error: errorMessage, updatedAt: new Date() })
      .where(eq(jobs.id, payload.jobId));

    msg.term();

    logger.error({ error: errorMessage }, 'Render failed');
  } finally {
    if (inputPath) cleanupFile(inputPath);
    if (outputPath) cleanupFile(outputPath);
  }
}
