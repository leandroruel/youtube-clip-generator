import { FastifyInstance } from 'fastify';

export async function jobsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const { id } = request.params;
    return { id, status: 'pending', type: 'unknown' };
  });

  app.get('/', async (request) => {
    return { jobs: [] };
  });
}
