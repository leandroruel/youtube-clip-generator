import { FastifyInstance } from 'fastify';

export async function clipsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const { id } = request.params;
    return { id, status: 'draft' };
  });

  app.get('/', async (request) => {
    return { clips: [] };
  });

  app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    return { id, updated: true };
  });
}
