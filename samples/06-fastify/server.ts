/// <reference path="./bella-secrets.d.ts" />

import Fastify from 'fastify';
import { bellaPlugin } from '@bella-baxter/config/fastify';
import { BELLA_COERCIONS } from './bella-coercions.js';

const app = Fastify({ logger: true });

await app.register(bellaPlugin, {
  baxterUrl: process.env.BELLA_BAXTER_URL ?? 'https://api.bella-baxter.io',
  apiKey: process.env.BELLA_BAXTER_API_KEY!,
  pollingInterval: 60_000,
  coercions: BELLA_COERCIONS,
});

const mask = (v: string | undefined, n = 4) =>
  v && v.length > n ? `${v.slice(0, n)}***` : v ?? '(not set)';

app.get('/', async (_req, _reply) => ({
  PORT:                        String(app.bella.PORT                        ?? '(not set)'),
  DATABASE_URL:                mask(app.bella.DATABASE_URL,                15),
  EXTERNAL_API_KEY:            mask(app.bella.EXTERNAL_API_KEY),
  GLEAP_API_KEY:               mask(app.bella.GLEAP_API_KEY),
  ENABLE_FEATURES:             String(app.bella.ENABLE_FEATURES             ?? '(not set)'),
  APP_ID:                      app.bella.APP_ID                             ?? '(not set)',
  ConnectionStrings__Postgres: mask(app.bella.ConnectionStrings__Postgres,  6),
  APP_CONFIG:                  app.bella.APP_CONFIG                         ?? '(not set)',
}));

app.get('/health', async (_req, _reply) => ({ ok: true }));

const PORT = parseInt(process.env.PORT ?? '3005', 10);
await app.listen({ port: PORT, host: '0.0.0.0' });

