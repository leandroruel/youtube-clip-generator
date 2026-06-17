import { FastifyInstance } from 'fastify';
import { db } from '@clipper/db/db';
import { clips, renders, embeddings } from '@clipper/db/schema';
import { eq, inArray } from 'drizzle-orm';

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
