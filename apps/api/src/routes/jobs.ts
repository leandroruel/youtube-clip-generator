import { FastifyInstance } from 'fastify';
import { db } from '@clipper/db/db';
import { jobs } from '@clipper/db/schema';
import { eq } from 'drizzle-orm';

export async function jobsRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const allJobs = await db.select().from(jobs).orderBy(jobs.createdAt);
    return { jobs: allJobs };
  });

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, request.params.id));
    if (!job) return reply.status(404).send({ error: 'Job not found' });
    return job;
  });
}
