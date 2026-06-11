import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@clipper/db/db';
import { jobs, videos } from '@clipper/db/schema';
import { JobType } from '@clipper/shared';
import { subjectForJobType, createNatsConnection, ensureJobStream } from '@clipper/queue';
import { env } from '../config/env.js';
import { eq } from 'drizzle-orm';

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
}
