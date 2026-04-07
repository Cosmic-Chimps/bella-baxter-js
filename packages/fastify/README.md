# @bella-baxter/fastify

[![npm](https://img.shields.io/npm/v/@bella-baxter/fastify)](https://www.npmjs.com/package/@bella-baxter/fastify)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Bella Baxter](https://github.com/Cosmic-Chimps/bella-baxter) plugin for Fastify — decorates the Fastify instance with `app.bella` for live-reloading secrets.

## Installation

```bash
npm install @bella-baxter/fastify fastify
# or
pnpm add @bella-baxter/fastify fastify
```

## Usage

```ts
import Fastify from 'fastify';
import { bellaPlugin } from '@bella-baxter/fastify';

const app = Fastify({ logger: true });

await app.register(bellaPlugin, {
  baxterUrl: process.env.BELLA_BAXTER_URL!,
  apiKey: process.env.BELLA_BAXTER_API_KEY!,
  projectSlug: 'my-app',         // or BELLA_BAXTER_PROJECT env var
  environmentSlug: 'production',  // or BELLA_BAXTER_ENV env var
});

app.get('/health', async () => {
  const dbUrl = app.bella.getOrThrow('DATABASE_URL');
  return { ok: true };
});

await app.listen({ port: 3000 });
```

`app.bella` is typed as `BellaConfig & BellaSecrets` — after running `bella secrets generate typescript --declaration`, typed property access works automatically:

```ts
app.bella.DATABASE_URL  // string — typed!
```

## Lifecycle

The plugin hooks into `onClose` to call `bella.destroy()` — polling stops cleanly when Fastify shuts down.

## Environment variables

| Variable | Description |
|----------|-------------|
| `BELLA_BAXTER_URL` | Base URL of the Bella Baxter API |
| `BELLA_BAXTER_API_KEY` | API key (`bax-...`) |
| `BELLA_BAXTER_PROJECT` | Project slug |
| `BELLA_BAXTER_ENV` | Environment slug |
| `BELLA_BAXTER_PRIVATE_KEY` | Private key for ZKE (optional) |

## Links

- [GitHub](https://github.com/Cosmic-Chimps/bella-baxter)
- [Issues](https://github.com/Cosmic-Chimps/bella-baxter/issues)
- [Core SDK](https://www.npmjs.com/package/@bella-baxter/sdk)
