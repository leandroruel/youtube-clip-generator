import { createWriteStream } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { type NatsConnection, consumerOpts } from 'nats';
import { createNatsConnection, ensureJobStream, subjectForJobType } from '@clipper/queue';
import { createS3Client, getObject, ensureBucket } from '@clipper/storage';
import { jobs, videos, transcripts } from '@clipper/db/schema';
import { JobStatus, JobType } from '@clipper/shared';
import type { Logger } from '@clipper/logger';
import { config } from './config.js';
import { transcribeAudio, cleanupFile } from './transcriber.js';

export interface NatsMsg {
  ack: () => void;
  term: (reason?: string) => void;
  data: Uint8Array;
}

export interface SpeechToTextPayload {
  jobId: string;
  projectId: string;
  videoId: string;
}

export interface SpeechToTextResult {
  transcriptId: string;
  segmentsCount: number;
  language: string;
  fullTextLength: number;
}

export type DB = ReturnType<typeof drizzle>;
export type S3 = ReturnType<typeof createS3Client>['client'];

export async function startWorker(nc: NatsConnection, logger: Logger) {
  const sql = postgres(config.DATABASE_URL, { prepare: false });
  const db = drizzle(sql, { schema: { jobs, videos, transcripts } });

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
  opts.durable('speech-to-text');
  opts.manualAck();
  opts.ackExplicit();
  opts.maxDeliver(3);
  opts.ackWait(600_000);

  const subject = subjectForJobType(JobType.SPEECH_TO_TEXT);
  const sub = await js.pullSubscribe(subject, opts);

  logger.info({ subject }, 'Listening for speech-to-text jobs');

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
  const payload: SpeechToTextPayload = JSON.parse(new TextDecoder().decode(msg.data));
  logger.info({ videoId: payload.videoId }, 'Processing speech-to-text');

  await db.update(jobs)
    .set({ status: JobStatus.PROCESSING, updatedAt: new Date() })
    .where(eq(jobs.id, payload.jobId));

  let audioPath: string | null = null;

  try {
    const [video] = await db.select()
      .from(videos)
      .where(eq(videos.id, payload.videoId));

    if (!video || !video.audioPath) {
      throw new Error('Video not found or no audio path available');
    }

    audioPath = `${config.DOWNLOAD_DIR}/${payload.videoId}.opus`;

    const response = await getObject(s3, bucket, video.audioPath);
    const bodyStream = response.Body as NodeJS.ReadableStream;
    if (!bodyStream) throw new Error('Empty response body from S3');

    await pipeline(bodyStream, createWriteStream(audioPath));

    const result = transcribeAudio(audioPath);

    const [transcript] = await db.insert(transcripts).values({
      videoId: payload.videoId,
      fullText: result.fullText,
      segments: result.segments,
      model: result.modelName,
      language: result.language,
    }).returning();

    if (!transcript) throw new Error('Failed to create transcript record');

    await db.update(videos)
      .set({ status: 'transcribed', updatedAt: new Date() })
      .where(eq(videos.id, payload.videoId));

    await db.update(jobs)
      .set({
        status: JobStatus.COMPLETED,
        result: {
          transcriptId: transcript.id,
          segmentsCount: result.segments.length,
          language: result.language,
          fullTextLength: result.fullText.length,
        } as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, payload.jobId));

    msg.ack();

    logger.info(
      { videoId: payload.videoId, segments: result.segments.length, language: result.language },
      'Transcription complete',
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db.update(jobs)
      .set({ status: JobStatus.FAILED, error: errorMessage, updatedAt: new Date() })
      .where(eq(jobs.id, payload.jobId));

    msg.term();

    logger.error({ error: errorMessage }, 'Transcription failed');
  } finally {
    if (audioPath) {
      cleanupFile(audioPath);
    }
  }
}
