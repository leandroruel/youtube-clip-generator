import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@clipper/db/db';
import { jobs, videos, clips, transcripts, renders, embeddings } from '@clipper/db/schema';
import { JobType } from '@clipper/shared';
import { subjectForJobType, createNatsConnection, ensureJobStream } from '@clipper/queue';
import { env } from '../config/env.js';
import { eq, inArray, and } from 'drizzle-orm';

const createVideoSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(255),
  source: z.enum(['youtube', 'upload']),
  sourceUrl: z.string().url().optional(),
});

const submitYoutubeSchema = z.object({
  projectId: z.string().uuid(),
  youtubeUrl: z.string().url(),
});

export async function videosRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const body = createVideoSchema.parse(request.body);
    return reply.status(201).send({ id: 'placeholder', ...body });
  });

  app.post('/youtube', async (request, reply) => {
    const body = submitYoutubeSchema.parse(request.body);

    const [job] = await db.insert(jobs).values({
      projectId: body.projectId,
      type: JobType.YOUTUBE_DOWNLOAD,
      status: 'queued',
      payload: { youtubeUrl: body.youtubeUrl },
    }).returning();

    if (!job) {
      return reply.status(500).send({ error: 'Failed to create job' });
    }

    const nc = await createNatsConnection(env.NATS_URL);
    await ensureJobStream(nc);
    const js = nc.jetstream();
    const subject = subjectForJobType(JobType.YOUTUBE_DOWNLOAD);
    await js.publish(subject, new TextEncoder().encode(
      JSON.stringify({
        jobId: job.id,
        projectId: body.projectId,
        youtubeUrl: body.youtubeUrl,
      }),
    ));
    await nc.drain();

    return reply.status(202).send({
      message: 'Video submitted for processing',
      jobId: job.id,
    });
  });

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    if (!video) {
      return reply.status(404).send({ error: 'Video not found' });
    }
    return video;
  });

  app.get('/', async (request) => {
    const allVideos = await db.select().from(videos);
    return { videos: allVideos };
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    if (!video) {
      return reply.status(404).send({ error: 'Video not found' });
    }

    const videoClips = await db.select({ id: clips.id }).from(clips)
      .where(eq(clips.videoId, id));

    if (videoClips.length > 0) {
      const clipIds = videoClips.map((c) => c.id);

      await db.delete(renders).where(inArray(renders.clipId, clipIds));
      await db.delete(embeddings).where(inArray(embeddings.clipId, clipIds));
      await db.delete(clips).where(eq(clips.videoId, id));
    }

    const videoTranscripts = await db.select({ id: transcripts.id }).from(transcripts)
      .where(eq(transcripts.videoId, id));

    if (videoTranscripts.length > 0) {
      const transcriptIds = videoTranscripts.map((t) => t.id);

      await db.delete(embeddings)
        .where(inArray(embeddings.transcriptId, transcriptIds));
      await db.delete(transcripts).where(eq(transcripts.videoId, id));
    }

    await db.delete(jobs)
      .where(and(eq(jobs.projectId, video.projectId), eq(jobs.type, JobType.YOUTUBE_DOWNLOAD)));

    await db.delete(videos).where(eq(videos.id, id));

    return reply.status(200).send({ message: 'Video deleted' });
  });
}
