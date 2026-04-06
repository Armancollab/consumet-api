require('dotenv').config();

import Fastify from 'fastify';
import FastifyCors from '@fastify/cors';

import anime from './routes/anime';
import meta from './routes/meta';

(async () => {
  const PORT = Number(process.env.PORT);
  const fastify = Fastify({
    logger: true,
  });

  await fastify.register(FastifyCors, {
    origin: '*',
    methods: 'GET',
  });

  await fastify.register(anime, { prefix: '/anime' });
  await fastify.register(meta, { prefix: '/meta' });

  try {
    fastify.get('/', (_, reply) => {
      reply.status(200).send({
        message: 'Welcome to consumet api!',
        routes: ['/anime', '/meta'],
      });
    });

    fastify.get('*', (_, reply) => {
      reply.status(404).send({
        error: 'page not found',
        message: '',
      });
    });

    fastify.listen({ port: PORT, host: '0.0.0.0' }, (error, address) => {
      if (error) {
        throw error;
      }

      console.log(`server listening on ${address}`);
    });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
})();

