import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@clipper/db/db';
import { renders } from '@clipper/db/schema';
import { eq } from 'drizzle-orm';

const createRenderSchema = z.object({
  projectId: z.string().uuid(),
  clipId: z.string().uuid().optional(),
  format: z.enum(['mp4', 'webm']).optional(),
  resolution: z.string().optional(),
});

export async function rendersRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const body = createRenderSchema.parse(request.body);
    const [render] = await db.insert(renders).values(body).returning();
    return reply.status(201).send(render);
  });

  app.get('/', async (request) => {
    const allRenders = await db.select().from(renders).orderBy(renders.createdAt);
    return { renders: allRenders };
  });

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const [render] = await db.select().from(renders).where(eq(renders.id, request.params.id));
    if (!render) return reply.status(404).send({ error: 'Render not found' });
    return render;
  });
}
