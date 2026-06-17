import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import authPlugin from './plugins/auth.js';
import { env } from './config/env.js';
import { projectsRoutes } from './routes/projects.js';
import { videosRoutes } from './routes/videos.js';
import { clipsRoutes } from './routes/clips.js';
import { jobsRoutes } from './routes/jobs.js';
import { rendersRoutes } from './routes/renders.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(cors, {
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Video Clipper Generator API',
        version: '0.1.0',
        description: 'API for generating AI-powered video clips',
      },
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  });

  await app.register(authPlugin);

  await app.register(projectsRoutes, { prefix: '/v1/projects' });
  await app.register(videosRoutes, { prefix: '/v1/videos' });
  await app.register(clipsRoutes, { prefix: '/v1/clips' });
  await app.register(jobsRoutes, { prefix: '/v1/jobs' });
  await app.register(rendersRoutes, { prefix: '/v1/renders' });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
