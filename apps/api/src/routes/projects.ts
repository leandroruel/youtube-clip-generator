import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createProjectSchema = z.object({
  title: z.string().min(1).max(255),
});

export async function projectsRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const body = createProjectSchema.parse(request.body);
    return reply.status(201).send({ id: 'placeholder', ...body });
  });

  app.get('/', async (request) => {
    return { projects: [] };
  });

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    return { id, title: 'Project', status: 'created' };
  });

  app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    return { id, updated: true };
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    return reply.status(204).send();
  });
}
