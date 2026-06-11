import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createVideoSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(255),
  source: z.enum(['youtube', 'upload']),
  sourceUrl: z.string().url().optional(),
});

const submitYoutubeSchema = z.object({
  projectId: z.string().uuid(),
  youtubeUrl: z.string().url(),
});

export async function videosRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const body = createVideoSchema.parse(request.body);
    return reply.status(201).send({ id: 'placeholder', ...body });
  });

  app.post('/youtube', async (request, reply) => {
    const body = submitYoutubeSchema.parse(request.body);
    return reply.status(202).send({
      message: 'Video submitted for processing',
      videoId: 'placeholder',
      jobId: 'placeholder',
    });
  });

  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const { id } = request.params;
    return { id, title: 'Video', status: 'pending' };
  });

  app.get('/', async (request) => {
    return { videos: [] };
  });
}
