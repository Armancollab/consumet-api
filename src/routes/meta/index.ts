import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { META } from '@consumet/extensions';

import {
  buildProviderRegistry,
  invokeProviderMethod,
  parseArgs,
  parseBoolean,
  parseNumber,
  RegisteredProvider,
  toSlug,
} from '../../utils/providers';

const metaProviders = buildProviderRegistry(META as unknown as Record<string, unknown>);
const availableMetaProviders = Object.keys(metaProviders).sort((left, right) =>
  left.localeCompare(right)
);

type ProviderParams = { metaProvider: string };
type SearchParams = ProviderParams & { query: string };
type IdParams = ProviderParams & { id: string };
type EpisodeParams = ProviderParams & { episodeId: string };
type CallParams = ProviderParams & { method: string };
type PaginationQuery = { page?: number | string; perPage?: number | string };
type MetaInfoQuery = { dub?: boolean | string; fetchFiller?: boolean | string; type?: string };
type MetaEpisodeQuery = { args?: unknown[] | string; type?: string };

const getProviderOrReply = (
  reply: FastifyReply,
  metaProvider: string
): RegisteredProvider | null => {
  const provider = metaProviders[toSlug(decodeURIComponent(metaProvider))];

  if (provider) {
    return provider;
  }

  reply.status(404).send({
    availableProviders: availableMetaProviders,
    message: 'Provider not found, please check the providers list.',
  });

  return null;
};

const getProviderRoutes = (provider: RegisteredProvider): string[] => {
  const routes = [`/meta/${provider.key}/search/:query`, `/meta/${provider.key}/call/:method`];

  if (provider.methods.includes('fetchAnimeInfo') || provider.methods.includes('fetchMediaInfo')) {
    routes.push(`/meta/${provider.key}/info/:id`);
  }

  if (provider.methods.includes('fetchEpisodeSources')) {
    routes.push(`/meta/${provider.key}/watch/:episodeId`);
  }

  if (provider.methods.includes('fetchEpisodeServers')) {
    routes.push(`/meta/${provider.key}/servers/:episodeId`);
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
      availableProviders: availableMetaProviders,
      message: 'Welcome to Consumet Meta',
      notes: [
        'Use /meta/:provider/search/:query for standard searches.',
        'TMDB info requests require /meta/tmdb/info/:id?type=movie or ?type=tv.',
        'Use /meta/:provider/call/:method?args[]=... for provider-specific methods.',
      ],
    });
  });

  fastify.get(
    '/:metaProvider/search/:query',
    async (
      request: FastifyRequest<{
        Params: SearchParams;
        Querystring: PaginationQuery;
      }>,
      reply: FastifyReply
    ) => {
      const provider = getProviderOrReply(reply, request.params.metaProvider);

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
    '/:metaProvider/info/:id',
    async (
      request: FastifyRequest<{
        Params: IdParams;
        Querystring: MetaInfoQuery;
      }>,
      reply: FastifyReply
    ) => {
      const provider = getProviderOrReply(reply, request.params.metaProvider);

      if (!provider) {
        return;
      }

      const id = decodeURIComponent(request.params.id);

      if (provider.methods.includes('fetchMediaInfo')) {
        if (!request.query.type) {
          reply.status(400).send({
            message: 'This provider requires a type query parameter.',
          });

          return;
        }

        await sendProviderMethodResult(reply, provider, 'fetchMediaInfo', [id, request.query.type]);
        return;
      }

      const dub = parseBoolean(request.query.dub);
      const fetchFiller = parseBoolean(request.query.fetchFiller);

      await sendProviderMethodResult(reply, provider, 'fetchAnimeInfo', [id, dub, fetchFiller]);
    }
  );

  fastify.get(
    '/:metaProvider/watch/:episodeId',
    async (
      request: FastifyRequest<{
        Params: EpisodeParams;
        Querystring: MetaEpisodeQuery;
      }>,
      reply: FastifyReply
    ) => {
      const provider = getProviderOrReply(reply, request.params.metaProvider);

      if (!provider) {
        return;
      }

      const episodeId = decodeURIComponent(request.params.episodeId);
      const args = parseArgs(request.query.args);

      if (args.length > 0) {
        await sendProviderMethodResult(reply, provider, 'fetchEpisodeSources', [episodeId, ...args]);
        return;
      }

      if (request.query.type) {
        await sendProviderMethodResult(reply, provider, 'fetchEpisodeSources', [episodeId, request.query.type]);
        return;
      }

      await sendProviderMethodResult(reply, provider, 'fetchEpisodeSources', [episodeId]);
    }
  );

  fastify.get(
    '/:metaProvider/servers/:episodeId',
    async (
      request: FastifyRequest<{
        Params: EpisodeParams;
        Querystring: MetaEpisodeQuery;
      }>,
      reply: FastifyReply
    ) => {
      const provider = getProviderOrReply(reply, request.params.metaProvider);

      if (!provider) {
        return;
      }

      const episodeId = decodeURIComponent(request.params.episodeId);
      const args = parseArgs(request.query.args);

      if (args.length > 0) {
        await sendProviderMethodResult(reply, provider, 'fetchEpisodeServers', [episodeId, ...args]);
        return;
      }

      if (request.query.type) {
        await sendProviderMethodResult(reply, provider, 'fetchEpisodeServers', [episodeId, request.query.type]);
        return;
      }

      await sendProviderMethodResult(reply, provider, 'fetchEpisodeServers', [episodeId]);
    }
  );

  fastify.get(
    '/:metaProvider/call/:method',
    async (
      request: FastifyRequest<{
        Params: CallParams;
        Querystring: MetaEpisodeQuery;
      }>,
      reply: FastifyReply
    ) => {
      const provider = getProviderOrReply(reply, request.params.metaProvider);

      if (!provider) {
        return;
      }

      const methodName = decodeURIComponent(request.params.method);
      const args = parseArgs(request.query.args);

      await sendProviderMethodResult(reply, provider, methodName, args);
    }
  );

  fastify.get(
    '/:metaProvider',
    async (request: FastifyRequest<{ Params: ProviderParams }>, reply: FastifyReply) => {
      const provider = getProviderOrReply(reply, request.params.metaProvider);

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

