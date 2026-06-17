import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Readable } from 'node:stream';
import { db } from '@clipper/db/db';
import { jobs, videos, clips, transcripts, renders, embeddings } from '@clipper/db/schema';
import { JobType } from '@clipper/shared';
import { subjectForJobType, createNatsConnection, ensureJobStream } from '@clipper/queue';
import { createS3Client, getObject } from '@clipper/storage';
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

function extractYoutubeTitle(url: string): string {
  try {
    const u = new URL(url);
    const id = u.hostname.includes('youtu.be')
      ? u.pathname.slice(1).split('?')[0]
      : u.searchParams.get('v');
    return id ? `Video ${id.slice(0, 8)}` : 'New Video';
  } catch {
    return 'New Video';
  }
}

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

    const [video] = await db.insert(videos).values({
      projectId: body.projectId,
      title: extractYoutubeTitle(body.youtubeUrl),
      source: 'youtube',
      sourceUrl: body.youtubeUrl,
      status: 'pending',
    }).returning();

    if (!video) {
      return reply.status(500).send({ error: 'Failed to create video record' });
    }

    const nc = await createNatsConnection(env.NATS_URL);
    await ensureJobStream(nc);
    const js = nc.jetstream();
    const subject = subjectForJobType(JobType.YOUTUBE_DOWNLOAD);
    await js.publish(subject, new TextEncoder().encode(
      JSON.stringify({
        jobId: job.id,
        projectId: body.projectId,
        videoId: video.id,
        youtubeUrl: body.youtubeUrl,
      }),
    ));
    await nc.drain();

    return reply.status(202).send({
      message: 'Video submitted for processing',
      jobId: job.id,
      videoId: video.id,
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

  app.get<{ Params: { id: string } }>('/:id/stream', async (request, reply) => {
    const { id } = request.params;
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    if (!video) {
      return reply.status(404).send({ error: 'Video not found' });
    }

    const proxyKey = video.proxyPath;
    if (!proxyKey) {
      return reply.status(404).send({ error: 'Video preview not available yet' });
    }

    const s3Config = {
      endpoint: env.GARAGE_ENDPOINT,
      region: env.GARAGE_REGION,
      accessKeyId: env.GARAGE_ACCESS_KEY,
      secretAccessKey: env.GARAGE_SECRET_KEY,
      bucket: env.GARAGE_BUCKET,
    };

    const { client, bucket } = createS3Client(s3Config);

    const range = request.headers.range as string | undefined;

    try {
      const s3Response = await getObject(client, bucket, proxyKey, range);
      const contentLength = s3Response.ContentLength;
      const contentType = s3Response.ContentType ?? 'video/mp4';

      const headers: Record<string, string | number | undefined> = {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Range',
      };

      if (range && s3Response.ContentRange) {
        reply.raw.writeHead(206, {
          ...headers,
          'Content-Range': s3Response.ContentRange,
          'Content-Length': contentLength,
        });
      } else {
        reply.raw.writeHead(200, {
          ...headers,
          'Content-Length': contentLength,
        });
      }

      if (s3Response.Body) {
        const stream = s3Response.Body as Readable;
        await new Promise<void>((resolve, reject) => {
          stream.pipe(reply.raw);
          stream.on('end', resolve);
          stream.on('error', reject);
        });
      } else {
        reply.raw.end();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err, videoId: id }, 'Failed to stream video');
      if (!reply.raw.headersSent) {
        reply.status(500).send({ error: 'Failed to stream video' });
      } else {
        reply.raw.destroy(new Error(message));
      }
    }
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
