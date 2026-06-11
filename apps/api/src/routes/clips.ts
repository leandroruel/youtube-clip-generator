import { FastifyInstance } from 'fastify';
import { db } from '@clipper/db/db';
import { clips } from '@clipper/db/schema';
import { eq } from 'drizzle-orm';

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
}
