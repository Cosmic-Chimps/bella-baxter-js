import express from 'express';
import { createBellaMiddleware } from '@bella-baxter/config/express';

const app = express();

app.use(
  await createBellaMiddleware({
    baxterUrl: process.env.BELLA_BAXTER_URL ?? 'https://api.bella-baxter.io',
    apiKey: process.env.BELLA_BAXTER_API_KEY,
    pollingInterval: 60_000,
  }),
);

const mask = (v, n = 4) => (v && v.length > n ? `${v.slice(0, n)}***` : v ?? '(not set)');

app.get('/', (req, res) => {
  res.json({
    PORT:                       req.bella?.get('PORT')                       ?? process.env.PORT                       ?? '(not set)',
    DATABASE_URL:               mask(req.bella?.get('DATABASE_URL')               ?? process.env.DATABASE_URL,               15),
    EXTERNAL_API_KEY:           mask(req.bella?.get('EXTERNAL_API_KEY')           ?? process.env.EXTERNAL_API_KEY),
    GLEAP_API_KEY:              mask(req.bella?.get('GLEAP_API_KEY')              ?? process.env.GLEAP_API_KEY),
    ENABLE_FEATURES:            req.bella?.get('ENABLE_FEATURES')            ?? process.env.ENABLE_FEATURES            ?? '(not set)',
    APP_ID:                     req.bella?.get('APP_ID')                     ?? process.env.APP_ID                     ?? '(not set)',
    // eslint-disable-next-line dot-notation
    ConnectionStrings__Postgres: mask(req.bella?.get('ConnectionStrings__Postgres') ?? process.env['ConnectionStrings__Postgres'], 6),
    APP_CONFIG:                 req.bella?.get('APP_CONFIG')                 ?? process.env.APP_CONFIG                 ?? '(not set)',
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT ?? 3005;
app.listen(PORT, () => console.log(`Express listening on :${PORT}`));

