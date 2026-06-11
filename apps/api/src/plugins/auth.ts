import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('userId', '');

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (env.NODE_ENV === 'development' && !request.headers.authorization) {
      request.userId = 'dev-user-id';
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing authorization token' });
    }

    const token = authHeader.slice(7);

    try {
      const decoded = await verifyClerkToken(token);
      request.userId = decoded.sub;
    } catch {
      return reply.status(401).send({ error: 'Invalid authorization token' });
    }
  });
}

async function verifyClerkToken(token: string): Promise<{ sub: string }> {
  if (!env.CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY not configured');
  }

  const response = await fetch('https://api.clerk.com/v1/tokens/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error('Token verification failed');
  }

  return response.json() as Promise<{ sub: string }>;
}

export default fp(authPlugin, { name: 'auth' });
