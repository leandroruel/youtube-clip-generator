import { createWriteStream, createReadStream, mkdirSync } from 'node:fs';
import { execSync, type ExecSyncOptions } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { type NatsConnection, consumerOpts } from 'nats';
import { createNatsConnection, ensureJobStream, subjectForJobType } from '@clipper/queue';
import { createS3Client, ensureBucket, getObject, uploadStream } from '@clipper/storage';
import { jobs, clips, transcripts, videos } from '@clipper/db/schema';
import { JobStatus, JobType, type CaptionStyle, type TranscriptSegment, defaultCaptionStyle } from '@clipper/shared';
import type { Logger } from '@clipper/logger';
import { config } from './config.js';
import { writeAssFile, type CaptionSegment } from './ass-generator.js';

const execOptions: ExecSyncOptions = {
  stdio: 'pipe',
  timeout: 600_000,
};

export interface NatsMsg {
  ack: () => void;
  term: (reason?: string) => void;
  data: Uint8Array;
}

export interface CaptionRenderPayload {
  jobId: string;
  projectId: string;
  clipId: string;
  captionStyle?: Partial<CaptionStyle>;
}

export type DB = ReturnType<typeof drizzle>;
export type S3 = ReturnType<typeof createS3Client>['client'] & { bucket: string };

export async function startWorker(nc: NatsConnection, logger: Logger) {
  const sql = postgres(config.DATABASE_URL, { prepare: false });
  const db = drizzle(sql, { schema: { jobs, clips, transcripts, videos } });

  const s3Config = {
    endpoint: config.GARAGE_ENDPOINT,
    region: config.GARAGE_REGION,
    accessKeyId: config.GARAGE_ACCESS_KEY,
    secretAccessKey: config.GARAGE_SECRET_KEY,
    bucket: config.GARAGE_BUCKET,
  };

  const { client: s3, bucket } = createS3Client(s3Config);
  await ensureBucket(s3, bucket);
  mkdirSync(config.DOWNLOAD_DIR, { recursive: true });

  await ensureJobStream(nc);
  const js = nc.jetstream();

  const opts = consumerOpts();
  opts.durable('caption-renderer');
  opts.manualAck();
  opts.ackExplicit();
  opts.maxDeliver(3);
  opts.ackWait(600_000);

  const subject = subjectForJobType(JobType.CAPTION_RENDER);
  const sub = await js.pullSubscribe(subject, opts);

  logger.info({ subject }, 'Listening for caption render jobs');

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
  const payload: CaptionRenderPayload = JSON.parse(new TextDecoder().decode(msg.data));
  logger.info({ clipId: payload.clipId }, 'Processing caption render');

  await db.update(jobs)
    .set({ status: JobStatus.PROCESSING, updatedAt: new Date() })
    .where(eq(jobs.id, payload.jobId));

  let assPath: string | null = null;
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    const [clip] = await db.select()
      .from(clips)
      .where(eq(clips.id, payload.clipId));

    if (!clip) throw new Error('Clip not found');

    const [transcript] = await db.select()
      .from(transcripts)
      .where(eq(transcripts.videoId, clip.videoId));

    if (!transcript) throw new Error('Transcript not found for clip video');

    const allSegments = transcript.segments as unknown as TranscriptSegment[];

    const clipSegments: CaptionSegment[] = allSegments
      .filter(s => s.start >= clip.startTime && s.end <= clip.endTime)
      .map(s => ({
        start: s.start - clip.startTime,
        end: s.end - clip.startTime,
        text: s.text,
      }));

    if (clipSegments.length === 0) throw new Error('No caption segments found for clip range');

    const style: CaptionStyle = { ...defaultCaptionStyle, ...payload.captionStyle };

    assPath = `${config.DOWNLOAD_DIR}/${payload.clipId}.ass`;
    writeAssFile(clipSegments, style, assPath);

    const assKey = `captions/${payload.clipId}.ass`;
    await uploadStream(s3, bucket, assKey, createReadStream(assPath), 'text/plain');

    const [video] = await db.select()
      .from(videos)
      .where(eq(videos.id, clip.videoId));

    if (!video || !video.originalPath) throw new Error('Video not found or no original path');

    inputPath = `${config.DOWNLOAD_DIR}/${payload.clipId}-input.mp4`;
    outputPath = `${config.DOWNLOAD_DIR}/${payload.clipId}-captioned.mp4`;

    const response = await getObject(s3, bucket, video.originalPath);
    const bodyStream = response.Body as NodeJS.ReadableStream;
    if (!bodyStream) throw new Error('Empty response body from S3');

    await pipeline(bodyStream, createWriteStream(inputPath));

    execSync(
      `ffmpeg -y ` +
      `-i "${inputPath}" ` +
      `-vf "ass='${assPath}'" ` +
      `-c:a copy ` +
      `"${outputPath}"`,
      { ...execOptions, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
    );

    const outputKey = `clips/${payload.clipId}/captioned.mp4`;
    await uploadStream(s3, bucket, outputKey, createReadStream(outputPath), 'video/mp4');

    await db.update(clips)
      .set({ status: 'subtitled', updatedAt: new Date() })
      .where(eq(clips.id, payload.clipId));

    await db.update(jobs)
      .set({
        status: JobStatus.COMPLETED,
        result: {
          assKey,
          outputKey,
          segmentsCount: clipSegments.length,
          style,
        } as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, payload.jobId));

    msg.ack();

    logger.info({ clipId: payload.clipId, segments: clipSegments.length, animation: style.animation }, 'Captions rendered');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db.update(jobs)
      .set({ status: JobStatus.FAILED, error: errorMessage, updatedAt: new Date() })
      .where(eq(jobs.id, payload.jobId));

    msg.term();

    logger.error({ error: errorMessage }, 'Caption render failed');
  } finally {
    if (assPath) removeFile(assPath);
    if (inputPath) removeFile(inputPath);
    if (outputPath) removeFile(outputPath);
  }
}

function removeFile(p: string) {
  try { execSync(`rm -f "${p}"`, { stdio: 'ignore' }); } catch { }
}
