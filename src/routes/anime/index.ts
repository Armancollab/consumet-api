import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ANIME } from '@consumet/extensions';

import {
  buildProviderRegistry,
  invokeProviderMethod,
  parseArgs,
  parseNumber,
  RegisteredProvider,
  toSlug,
} from '../../utils/providers';

const animeProviders = buildProviderRegistry(ANIME as unknown as Record<string, unknown>);
const availableAnimeProviders = Object.keys(animeProviders).sort((left, right) =>
  left.localeCompare(right)
);

type ProviderParams = { animeProvider: string };
type SearchParams = ProviderParams & { query: string };
type IdParams = ProviderParams & { id: string };
type EpisodeParams = ProviderParams & { episodeId: string };
type CallParams = ProviderParams & { method: string };
type PaginationQuery = { page?: number | string; perPage?: number | string };
type AnimeInfoQuery = { episodePage?: number | string };
type AnimeWatchQuery = { server?: string; subOrDub?: string };
type AnimeServersQuery = { subOrDub?: string };
type CallQuery = { args?: unknown[] | string };

const getProviderOrReply = (
  reply: FastifyReply,
  animeProvider: string
): RegisteredProvider | null => {
  const provider = animeProviders[toSlug(decodeURIComponent(animeProvider))];

  if (provider) {
    return provider;
  }

  reply.status(404).send({
    availableProviders: availableAnimeProviders,
    message: 'Provider not found, please check the providers list.',
  });

  return null;
};

const getProviderRoutes = (provider: RegisteredProvider): string[] => {
  const routes = [`/anime/${provider.key}/search/:query`, `/anime/${provider.key}/call/:method`];

  if (provider.methods.includes('fetchAnimeInfo')) {
    routes.push(`/anime/${provider.key}/info/:id`);
  }

  if (provider.methods.includes('fetchEpisodeSources')) {
    routes.push(`/anime/${provider.key}/watch/:episodeId`);
  }

  if (provider.methods.includes('fetchEpisodeServers')) {
    routes.push(`/anime/${provider.key}/servers/:episodeId`);
  }

  return routes;
};

const sendProviderMethodResult = async (
  reply: FastifyReply,
  provider: RegisteredProvider,
  methodName: string,
  args: unknown[] = []
): Promise<void> => {
  if (!provider.methods.includes(methodName)) {
    reply.status(404).send({
      message: `${provider.name} does not support ${methodName}.`,
      supportedMethods: provider.methods,
    });

    return;
  }

  try {
    const result = await invokeProviderMethod(provider, methodName, args);

    reply.status(200).send(result);
  } catch (error) {
    reply.status(500).send({
      message:
        error instanceof Error ? error.message : 'Something went wrong. Please try again later.',
    });
  }
};

const routes = async (fastify: FastifyInstance) => {
  fastify.get('/', async (_: FastifyRequest, reply: FastifyReply) => {
    reply.status(200).send({
      availableProviders: availableAnimeProviders,
      message: 'Welcome to Consumet Anime 🗾',
      notes: [
        'Use /anime/:provider/search/:query for standard searches.',
        'Use /anime/:provider/call/:method?args[]=... for provider-specific methods.',
      ],
    });
  });

  fastify.get(
    '/:animeProvider/search/:query',
    async (
      request: FastifyRequest<{
        Params: SearchParams;
        Querystring: PaginationQuery;
      }>,
      reply: FastifyReply
    ) => {
      const provider = getProviderOrReply(reply, request.params.animeProvider);

      if (!provider) {
        return;
      }

      const query = decodeURIComponent(request.params.query);
      const page = parseNumber(request.query.page);
      const perPage = parseNumber(request.query.perPage);

      await sendProviderMethodResult(reply, provider, 'search', [query, page, perPage]);
    }
  );

  fastify.get(
    '/:animeProvider/info/:id',
    async (
      request: FastifyRequest<{
        Params: IdParams;
        Querystring: AnimeInfoQuery;
      }>,
      reply: FastifyReply
    ) => {
      const provider = getProviderOrReply(reply, request.params.animeProvider);

      if (!provider) {
        return;
      }

      const id = decodeURIComponent(request.params.id);
      const episodePage = parseNumber(request.query.episodePage);
      const args = episodePage === undefined ? [id] : [id, episodePage];

      await sendProviderMethodResult(reply, provider, 'fetchAnimeInfo', args);
    }
  );

  fastify.get(
    '/:animeProvider/watch/:episodeId',
    async (
      request: FastifyRequest<{
        Params: EpisodeParams;
        Querystring: AnimeWatchQuery;
      }>,
      reply: FastifyReply
    ) => {
      const provider = getProviderOrReply(reply, request.params.animeProvider);

      if (!provider) {
        return;
      }

      const episodeId = decodeURIComponent(request.params.episodeId);

      await sendProviderMethodResult(reply, provider, 'fetchEpisodeSources', [
        episodeId,
        request.query.server,
        request.query.subOrDub,
      ]);
    }
  );

  fastify.get(
    '/:animeProvider/servers/:episodeId',
    async (
      request: FastifyRequest<{
        Params: EpisodeParams;
        Querystring: AnimeServersQuery;
      }>,
      reply: FastifyReply
    ) => {
      const provider = getProviderOrReply(reply, request.params.animeProvider);

      if (!provider) {
        return;
      }

      const episodeId = decodeURIComponent(request.params.episodeId);

      await sendProviderMethodResult(reply, provider, 'fetchEpisodeServers', [
        episodeId,
        request.query.subOrDub,
      ]);
    }
  );

  fastify.get(
    '/:animeProvider/call/:method',
    async (
      request: FastifyRequest<{
        Params: CallParams;
        Querystring: CallQuery;
      }>,
      reply: FastifyReply
    ) => {
      const provider = getProviderOrReply(reply, request.params.animeProvider);

      if (!provider) {
        return;
      }

      const methodName = decodeURIComponent(request.params.method);
      const args = parseArgs(request.query.args);

      await sendProviderMethodResult(reply, provider, methodName, args);
    }
  );

  fastify.get(
    '/:animeProvider',
    async (request: FastifyRequest<{ Params: ProviderParams }>, reply: FastifyReply) => {
      const provider = getProviderOrReply(reply, request.params.animeProvider);

      if (!provider) {
        return;
      }

      reply.status(200).send({
        provider: provider.name,
        routes: getProviderRoutes(provider),
        supportedMethods: provider.methods,
      });
    }
  );
};

export default routes;

