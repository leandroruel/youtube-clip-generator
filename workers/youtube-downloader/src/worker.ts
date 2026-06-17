import { createReadStream } from 'node:fs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { type NatsConnection, type JetStreamClient, consumerOpts } from 'nats';
import { ensureJobStream, subjectForJobType } from '@clipper/queue';
import { createS3Client, ensureBucket, uploadStream } from '@clipper/storage';
import { jobs, videos } from '@clipper/db/schema';
import { JobStatus, JobType } from '@clipper/shared';
import type { Logger } from '@clipper/logger';
import { config } from './config.js';
import { downloadAudio, cleanupAudio, getYouTubeMetadata } from './downloader.js';

export interface NatsMsg {
  ack: () => void;
  term: (reason?: string) => void;
  data: Uint8Array;
}

export interface YoutubeDownloadPayload {
  jobId: string;
  projectId: string;
  youtubeUrl: string;
}

export interface YoutubeDownloadResult {
  videoId: string;
  audioKey: string;
  title: string;
  duration: number;
  thumbnailUrl: string;
}

export type DB = ReturnType<typeof drizzle>;
export type S3 = ReturnType<typeof createS3Client>['client'];

export async function startWorker(nc: NatsConnection, logger: Logger) {
  const sql = postgres(config.DATABASE_URL, { prepare: false });
  const db = drizzle(sql, { schema: { jobs, videos } });

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
  opts.durable('youtube-downloader');
  opts.manualAck();
  opts.ackExplicit();
  opts.maxDeliver(3);
  opts.ackWait(600_000);

  const subject = subjectForJobType(JobType.YOUTUBE_DOWNLOAD);
  const sub = await js.pullSubscribe(subject, opts);

  logger.info({ subject }, 'Listening for download jobs');

  const pullNext = () => { sub.pull({ batch: 1 }); };
  pullNext();

  for await (const msg of sub as unknown as AsyncIterable<NatsMsg>) {
    try {
      await handleMessage(msg, db, s3, bucket, js, logger);
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
  js: JetStreamClient,
  logger: Logger,
) {
  const payload: YoutubeDownloadPayload = JSON.parse(new TextDecoder().decode(msg.data));
  logger.info({ youtubeUrl: payload.youtubeUrl }, 'Processing download');

  await db.update(jobs)
    .set({ status: JobStatus.PROCESSING, updatedAt: new Date() })
    .where(eq(jobs.id, payload.jobId));

  let filePath: string | null = null;

  try {
    logger.info({ cmd: `yt-dlp --dump-json ${payload.youtubeUrl}` }, 'Fetching metadata');
    const metadata = getYouTubeMetadata(payload.youtubeUrl);

    const [video] = await db.insert(videos).values({
      projectId: payload.projectId,
      title: metadata.title,
      source: 'youtube',
      sourceUrl: payload.youtubeUrl,
      duration: metadata.duration,
      thumbnailPath: metadata.thumbnail,
      status: 'downloading',
    }).returning();

    if (!video) throw new Error('Failed to create video record');

    const result = downloadAudio(payload.youtubeUrl, metadata.id);
    filePath = result.filePath;

    const audioKey = `audio/${metadata.id}.${config.AUDIO_FORMAT}`;

    await uploadStream(s3, bucket, audioKey, createReadStream(filePath), 'audio/opus');

    await db.update(videos)
      .set({ audioPath: audioKey, status: 'audio_ready', updatedAt: new Date() })
      .where(eq(videos.id, video.id));

    const jobResult: YoutubeDownloadResult = {
      videoId: video.id,
      audioKey,
      title: metadata.title,
      duration: metadata.duration,
      thumbnailUrl: metadata.thumbnail,
    };

    await db.update(jobs)
      .set({
        status: JobStatus.COMPLETED,
        result: jobResult as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, payload.jobId));

    const [sttJob] = await db.insert(jobs).values({
      projectId: payload.projectId,
      type: JobType.SPEECH_TO_TEXT,
      status: 'queued',
      payload: { videoId: video.id },
    }).returning();

    if (sttJob) {
      const sttSubject = subjectForJobType(JobType.SPEECH_TO_TEXT);
      await js.publish(sttSubject, new TextEncoder().encode(
        JSON.stringify({
          jobId: sttJob.id,
          projectId: payload.projectId,
          videoId: video.id,
        }),
      ));
    }

    msg.ack();

    logger.info({ title: metadata.title, videoId: video.id }, 'Download complete');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    let fullError = '';
    if (err instanceof Error) {
      fullError = `${err.name}: ${err.message}\n${err.stack || 'no stack'}`;
      if ('stderr' in err) {
        fullError += `\nSTDERR: ${(err as any).stderr}`;
      }
      if ('stdout' in err) {
        fullError += `\nSTDOUT: ${(err as any).stdout}`;
      }
    }

    await db.update(jobs)
      .set({ status: JobStatus.FAILED, error: errorMessage, updatedAt: new Date() })
      .where(eq(jobs.id, payload.jobId));

    msg.term();

    logger.error({ error: errorMessage, fullError }, 'Download failed');
  } finally {
    if (filePath) {
      cleanupAudio(filePath);
    }
  }
}
