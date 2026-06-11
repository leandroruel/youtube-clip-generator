import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { type NatsConnection, consumerOpts } from 'nats';
import { createNatsConnection, ensureJobStream, subjectForJobType } from '@clipper/queue';
import { jobs, videos, transcripts as transcriptsTable, clips } from '@clipper/db/schema';
import { JobStatus, JobType } from '@clipper/shared';
import type { Logger } from '@clipper/logger';
import type { TranscriptSegment, ClipCandidate } from '@clipper/shared';
import { config } from './config.js';
import { analyzeTranscript } from './analyzer.js';

export interface NatsMsg {
  ack: () => void;
  term: (reason?: string) => void;
  data: Uint8Array;
}

export interface ClipAnalysisPayload {
  jobId: string;
  projectId: string;
  videoId: string;
}

export type DB = ReturnType<typeof drizzle>;

export async function startWorker(nc: NatsConnection, logger: Logger) {
  const sql = postgres(config.DATABASE_URL, { prepare: false });
  const db = drizzle(sql, { schema: { jobs, videos, transcripts: transcriptsTable, clips } });

  await ensureJobStream(nc);
  const js = nc.jetstream();

  const opts = consumerOpts();
  opts.durable('clip-analyzer');
  opts.manualAck();
  opts.ackExplicit();
  opts.maxDeliver(3);
  opts.ackWait(300_000);

  const subject = subjectForJobType(JobType.CLIP_ANALYSIS);
  const sub = await js.pullSubscribe(subject, opts);

  logger.info({ subject }, 'Listening for clip analysis jobs');

  const pullNext = () => { sub.pull({ batch: 1 }); };
  pullNext();

  for await (const msg of sub as unknown as AsyncIterable<NatsMsg>) {
    try {
      await handleMessage(msg, db, logger);
    } catch (err) {
      logger.error(err, 'Failed to process message');
    }
    pullNext();
  }
}

export async function handleMessage(
  msg: NatsMsg,
  db: DB,
  logger: Logger,
) {
  const payload: ClipAnalysisPayload = JSON.parse(new TextDecoder().decode(msg.data));
  logger.info({ videoId: payload.videoId }, 'Processing clip analysis');

  await db.update(jobs)
    .set({ status: JobStatus.PROCESSING, updatedAt: new Date() })
    .where(eq(jobs.id, payload.jobId));

  try {
    const [transcript] = await db.select()
      .from(transcriptsTable)
      .where(eq(transcriptsTable.videoId, payload.videoId));

    if (!transcript) {
      throw new Error('Transcript not found for video');
    }

    const segments = transcript.segments as unknown as TranscriptSegment[];

    const candidates = analyzeTranscript(segments);

    if (candidates.length === 0) {
      throw new Error('No clip candidates found above minimum score');
    }

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]!;
      await db.insert(clips).values({
        projectId: payload.projectId,
        videoId: payload.videoId,
        startTime: Math.round(c.start),
        endTime: Math.round(c.end),
        text: c.text,
        viralScore: c.viralScore as unknown as Record<string, unknown>,
        rank: i + 1,
        status: 'candidate',
      });
    }

    const topCandidate = candidates[0];
    await db.update(jobs)
      .set({
        status: JobStatus.COMPLETED,
        result: {
          candidatesCount: candidates.length,
          topScore: topCandidate!.viralScore.total,
        } as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, payload.jobId));

    msg.ack();

    logger.info(
      { videoId: payload.videoId, candidates: candidates.length },
      'Clip analysis complete',
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db.update(jobs)
      .set({ status: JobStatus.FAILED, error: errorMessage, updatedAt: new Date() })
      .where(eq(jobs.id, payload.jobId));

    msg.term();

    logger.error({ error: errorMessage }, 'Clip analysis failed');
  }
}
