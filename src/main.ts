require('dotenv').config();

import fastify from 'fastify';
import FastifyCors from '@fastify/cors';

import anime from './routes/anime';
import meta from './routes/meta';

const start = async () => {
  const PORT = Number(process.env.PORT) || 3000;
  
  const app = fastify({
    logger: true,
  });

  try {
    await app.register(FastifyCors, {
      origin: '*',
      methods: 'GET',
    });

    await app.register(anime, { prefix: '/anime' });
    await app.register(meta, { prefix: '/meta' });

    app.get('/', async (request, reply) => {
      return reply.status(200).send({
        message: 'Welcome to consumet api!',
        routes: ['/anime', '/meta'],
      });
    });

    app.get('*', async (request, reply) => {
      return reply.status(404).send({
        error: 'page not found',
        message: '',
      });
    });

    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
