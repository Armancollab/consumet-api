require('dotenv').config();

import Fastify from 'fastify';
import FastifyCors from '@fastify/cors';

import anime from './routes/anime';
import meta from './routes/meta';

(async () => {
  const PORT = Number(process.env.PORT) || 3000;
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
    fastify.get('/', (_, rp) => {
      rp.status(200).send('Welcome to consumet api! 🎉');
    });
    
    fastify.get('*', (request, reply) => {
      reply.status(404).send({
        message: '',
        error: 'page not found',
      });
    });

    fastify.listen({ port: PORT, host: '0.0.0.0' }, (e, address) => {
      if (e) throw e;
      console.log(`server listening on ${address}`);
    });
  } catch (err: any) {
    fastify.log.error(err);
    process.exit(1);
  }
})();
