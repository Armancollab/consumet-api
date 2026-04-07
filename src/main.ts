require('dotenv').config();

import Fastify from 'fastify';
import FastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

import anime from './routes/anime';
import meta from './routes/meta';

const start = async () => {
  const PORT = Number(process.env.PORT) || 3000;
  
  const fastify: FastifyInstance = Fastify({
    logger: true,
  });

  try {
    await fastify.register(FastifyCors, {
      origin: '*',
      methods: 'GET',
    });

    await fastify.register(anime, { prefix: '/anime' });
    await fastify.register(meta, { prefix: '/meta' });

    fastify.get('/', async (_, reply) => {
      return reply.status(200).send({
        message: 'Welcome to consumet api!',
        routes: ['/anime', '/meta'],
      });
    });

    fastify.get('*', async (_, reply) => {
      return reply.status(404).send({
        error: 'page not found',
        message: '',
      });
    });

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
