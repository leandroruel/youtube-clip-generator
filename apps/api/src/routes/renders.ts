import { FastifyInstance } from 'fastify';

export async function rendersRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    return reply.status(201).send({ id: 'placeholder', status: 'pending' });
  });

  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const { id } = request.params;
    return { id, status: 'pending' };
  });

  app.get('/', async (request) => {
    return { renders: [] };
  });
}
