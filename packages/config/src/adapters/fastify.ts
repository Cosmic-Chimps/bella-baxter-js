/**
 * @bella-baxter/config/fastify
 *
 * Fastify plugin — decorates the Fastify instance with a `bella` property
 * containing a live-reloading BellaConfig instance.
 *
 * @example
 * ```ts
 * import Fastify from 'fastify';
 * import { bellaPlugin } from '@bella-baxter/config/fastify';
 *
 * const app = Fastify();
 *
 * await app.register(bellaPlugin, {
 *   baxterUrl: process.env.BELLA_BAXTER_URL!,
 *   environmentSlug: 'production',
 *   apiKey: process.env.BELLA_BAXTER_API_KEY!,
 *   
 * });
 *
 * app.get('/health', async (request, reply) => {
 *   const dbUrl = app.bella.getOrThrow('DATABASE_URL');
 *   return { ok: true };
 * });
 *
 * await app.listen({ port: 3000 });
 * ```
 *
 * TypeScript: Fastify augments the type automatically via the plugin declaration.
 */

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { BellaConfig, BellaSecrets, createBellaConfig, type BellaConfigOptions } from '../index.js';

export { BellaConfig, type BellaConfigOptions };

declare module 'fastify' {
  interface FastifyInstance {
    bella: BellaConfig & BellaSecrets;
  }
}

const bellaPluginImpl: FastifyPluginAsync<BellaConfigOptions> = async (
  fastify: FastifyInstance,
  options: BellaConfigOptions,
) => {
  const bella = await createBellaConfig(options);

  fastify.decorate('bella', bella);

  fastify.addHook('onClose', (_instance, done) => {
    bella.destroy();
    done();
  });
};

/**
 * Fastify plugin that decorates the Fastify instance with `bella`.
 * Uses `fastify-plugin` to avoid plugin scope isolation (bella is accessible from all routes).
 */
export const bellaPlugin = fp(bellaPluginImpl, {
  fastify: '>=4',
  name: 'bella-baxter',
});
