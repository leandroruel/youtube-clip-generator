import { FastifyInstance } from 'fastify';
import { Readable } from 'node:stream';
import { db } from '@clipper/db/db';
import { clips, renders, embeddings, videos } from '@clipper/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { createS3Client, getObject } from '@clipper/storage';
import { env } from '../config/env.js';

const BATCH_SIZE = 50;

export async function clipsRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const allClips = await db.select().from(clips).orderBy(clips.createdAt);
    return { clips: allClips };
  });

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const [clip] = await db.select().from(clips).where(eq(clips.id, request.params.id));
    if (!clip) return reply.status(404).send({ error: 'Clip not found' });
    return clip;
  });

  app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const [clip] = await db.update(clips)
      .set({ updatedAt: new Date() })
      .where(eq(clips.id, request.params.id))
      .returning();
    if (!clip) return reply.status(404).send({ error: 'Clip not found' });
    return clip;
  });

  app.get<{ Params: { id: string } }>('/:id/stream', async (request, reply) => {
    const [clip] = await db.select().from(clips).where(eq(clips.id, request.params.id));
    if (!clip) return reply.status(404).send({ error: 'Clip not found' });

    // If clip has rendered output, stream it
    if (clip.outputPath) {
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
        const s3Response = await getObject(client, bucket, clip.outputPath, range);
        const headers: Record<string, string | number | undefined> = {
          'Content-Type': s3Response.ContentType ?? 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Range',
        };
        if (range && s3Response.ContentRange) {
          reply.raw.writeHead(206, { ...headers, 'Content-Range': s3Response.ContentRange, 'Content-Length': s3Response.ContentLength });
        } else {
          reply.raw.writeHead(200, { ...headers, 'Content-Length': s3Response.ContentLength });
        }
        if (s3Response.Body) {
          const stream = s3Response.Body as Readable;
          await new Promise<void>((resolve, reject) => {
            stream.pipe(reply.raw);
            stream.on('end', resolve);
            stream.on('error', reject);
          });
        }
      } catch (err) {
        request.log.error({ err, clipId: clip.id }, 'Failed to stream clip');
        if (!reply.raw.headersSent) reply.status(500).send({ error: 'Failed to stream clip' });
      }
    } else {
      // No rendered output yet — redirect to video stream
      reply.redirect(`/v1/videos/${clip.videoId}/stream`);
    }
  });

  app.post<{ Body: { ids: string[] } }>('/bulk-delete', async (request, reply) => {
    const { ids } = request.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ error: 'ids must be a non-empty array' });
    }

    // Rate-limit: max 200 clips per request
    if (ids.length > 200) {
      return reply.status(400).send({ error: 'Cannot delete more than 200 clips at once' });
    }

    let totalDeleted = 0;

    // Process in batches of 50 to avoid overwhelming the DB
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);

      await db.transaction(async (tx) => {
        await tx.delete(renders).where(inArray(renders.clipId, batch));
        await tx.delete(embeddings).where(inArray(embeddings.clipId, batch));
        const result = await tx.delete(clips).where(inArray(clips.id, batch)).returning({ id: clips.id });
        totalDeleted += result.length;
      });
    }

    return { deleted: totalDeleted };
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const [clip] = await db.select().from(clips).where(eq(clips.id, id));
    if (!clip) return reply.status(404).send({ error: 'Clip not found' });

    await db.delete(renders).where(eq(renders.clipId, id));
    await db.delete(embeddings).where(eq(embeddings.clipId, id));
    await db.delete(clips).where(eq(clips.id, id));

    return reply.status(200).send({ message: 'Clip deleted' });
  });
}
