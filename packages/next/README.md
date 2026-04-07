# @bella-baxter/next

[![npm](https://img.shields.io/npm/v/@bella-baxter/next)](https://www.npmjs.com/package/@bella-baxter/next)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Bella Baxter](https://github.com/Cosmic-Chimps/bella-baxter) integration for Next.js (App Router) — load secrets once in `instrumentation.ts` and access them in any server component or API route.

> ⚠️ **Node.js runtime only.** Not compatible with the Edge runtime. For Edge routes, export secrets at deploy time with `bella secrets get -o .env.production` and read from `process.env`.

## Installation

```bash
npm install @bella-baxter/next
# or
pnpm add @bella-baxter/next
```

## Setup

### 1. Enable instrumentation (Next.js 14+)

```js
// next.config.js / next.config.ts
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
```

### 2. Initialize in `instrumentation.ts`

```ts
// instrumentation.ts
import { initBella } from '@bella-baxter/next';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await initBella({
      baxterUrl: process.env.BELLA_BAXTER_URL!,
      apiKey: process.env.BELLA_BAXTER_API_KEY!,
      projectSlug: 'my-app',         // or BELLA_BAXTER_PROJECT env var
      environmentSlug: 'production',  // or BELLA_BAXTER_ENV env var
    });
  }
}
```

### 3. Use anywhere server-side

```ts
// app/api/route.ts
import { getBella, bella } from '@bella-baxter/next';

export async function GET() {
  // Option A: full config object
  const config = getBella();
  const dbUrl = config.getOrThrow('DATABASE_URL');

  // Option B: direct shorthand
  const redisUrl = bella('REDIS_URL');

  return Response.json({ ok: true });
}
```

## Typed secrets

Run `bella secrets generate typescript --declaration` to generate `bella-secrets.d.ts`. `getBella()` returns `BellaConfig & BellaSecrets` — typed property access works automatically:

```ts
getBella().DATABASE_URL  // string — typed!
```

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
