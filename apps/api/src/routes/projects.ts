import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@clipper/db/db';
import { projects } from '@clipper/db/schema';
import { eq } from 'drizzle-orm';

const createProjectSchema = z.object({
  title: z.string().min(1).max(255),
});

export async function projectsRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const body = createProjectSchema.parse(request.body);
    const [project] = await db.insert(projects).values({
      userId: request.userId,
      title: body.title,
    }).returning();
    return reply.status(201).send(project);
  });

  app.get('/', async (request) => {
    const allProjects = await db.select().from(projects)
      .where(eq(projects.userId, request.userId))
      .orderBy(projects.createdAt);
    return { projects: allProjects };
  });

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const [project] = await db.select().from(projects)
      .where(eq(projects.id, request.params.id));
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return project;
  });

  app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = createProjectSchema.partial().parse(request.body);
    const [project] = await db.update(projects)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(projects.id, request.params.id))
      .returning();
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return project;
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    await db.delete(projects).where(eq(projects.id, request.params.id));
    return reply.status(204).send();
  });
}
