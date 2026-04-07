# @bella-baxter/express

[![npm](https://img.shields.io/npm/v/@bella-baxter/express)](https://www.npmjs.com/package/@bella-baxter/express)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Bella Baxter](https://github.com/Cosmic-Chimps/bella-baxter) middleware for Express.js — injects live-reloading secrets onto `req.bella`.

## Installation

```bash
npm install @bella-baxter/express express
# or
pnpm add @bella-baxter/express express
```

## Usage

```ts
import express from 'express';
import { createBellaMiddleware } from '@bella-baxter/express';

const app = express();

app.use(await createBellaMiddleware({
  baxterUrl: process.env.BELLA_BAXTER_URL!,
  apiKey: process.env.BELLA_BAXTER_API_KEY!,
  projectSlug: 'my-app',         // or BELLA_BAXTER_PROJECT env var
  environmentSlug: 'production',  // or BELLA_BAXTER_ENV env var
}));

app.get('/health', (req, res) => {
  const dbUrl = req.bella.getOrThrow('DATABASE_URL');
  res.json({ ok: true });
});

app.listen(3000);
```

## TypeScript — extend `req.bella`

```ts
// express.d.ts
import type { BellaConfig } from '@bella-baxter/express';

declare global {
  namespace Express {
    interface Request {
      bella: BellaConfig;
    }
  }
}
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
