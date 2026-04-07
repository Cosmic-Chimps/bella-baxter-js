# @bella-baxter/sdk

[![npm](https://img.shields.io/npm/v/@bella-baxter/sdk)](https://www.npmjs.com/package/@bella-baxter/sdk)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Core TypeScript SDK for [Bella Baxter](https://github.com/Cosmic-Chimps/bella-baxter) — a secure secret management gateway. Provides live-reloading secrets for Node.js apps, HMAC-signed API auth, and optional Zero-Knowledge Encryption (ZKE).

## Installation

```bash
npm install @bella-baxter/sdk
# or
pnpm add @bella-baxter/sdk
```

## Quick start

```ts
import { createBellaConfig } from '@bella-baxter/sdk';

const bella = await createBellaConfig({
  baxterUrl: process.env.BELLA_BAXTER_URL!,
  apiKey: process.env.BELLA_BAXTER_API_KEY!,
  projectSlug: 'my-app',       // or set BELLA_BAXTER_PROJECT env var
  environmentSlug: 'production', // or set BELLA_BAXTER_ENV env var
});

// Access secrets
const dbUrl = bella.get('DATABASE_URL');          // string | undefined
const port  = bella.getOrThrow('PORT');           // string — throws if missing
const all   = bella.getAll();                     // Record<string, string>

// Write all secrets into process.env (for legacy integrations)
bella.intoProcessEnv();

// Stop background polling when shutting down
bella.destroy();
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `BELLA_BAXTER_URL` | Base URL of the Bella Baxter API |
| `BELLA_BAXTER_API_KEY` | API key (`bax-...`), obtained from the WebApp or CLI |
| `BELLA_BAXTER_PROJECT` | Project slug (fallback for `projectSlug` option) |
| `BELLA_BAXTER_ENV` | Environment slug (fallback for `environmentSlug` option) |
| `BELLA_BAXTER_PRIVATE_KEY` | PKCS#8 PEM private key for ZKE (optional) |

## Typed secrets

Run the CLI to generate a typed declaration file:

```bash
bella secrets generate typescript --declaration
```

This generates `bella-secrets.d.ts` (ambient) and `bella-coercions.ts` (runtime). Pass coercions to get typed, coerced values:

```ts
import { BELLA_COERCIONS } from './bella-coercions.js';

const bella = await createBellaConfig({ coercions: BELLA_COERCIONS });

bella.PORT          // number — not string
bella.DATABASE_URL  // string
```

## Zero-Knowledge Encryption (ZKE)

When `BELLA_BAXTER_PRIVATE_KEY` is set (or `privateKey` option), secrets are end-to-end encrypted. The server never sees plaintext values.

```ts
const bella = await createBellaConfig({
  baxterUrl: '...',
  apiKey: '...',
  privateKey: process.env.BELLA_BAXTER_PRIVATE_KEY,
});
```

## Framework integrations

| Framework | Package |
|-----------|---------|
| Express | [`@bella-baxter/express`](https://www.npmjs.com/package/@bella-baxter/express) |
| Fastify | [`@bella-baxter/fastify`](https://www.npmjs.com/package/@bella-baxter/fastify) |
| NestJS | [`@bella-baxter/nestjs`](https://www.npmjs.com/package/@bella-baxter/nestjs) |
| Next.js | [`@bella-baxter/next`](https://www.npmjs.com/package/@bella-baxter/next) |
| AdonisJS | [`@bella-baxter/adonis`](https://www.npmjs.com/package/@bella-baxter/adonis) |
| React Native | [`@bella-baxter/react-native`](https://www.npmjs.com/package/@bella-baxter/react-native) |

## Links

- [Documentation](https://github.com/Cosmic-Chimps/bella-baxter/tree/main/apps/sdk/js/packages/sdk#readme)
- [GitHub](https://github.com/Cosmic-Chimps/bella-baxter)
- [Issues](https://github.com/Cosmic-Chimps/bella-baxter/issues)
- [npm](https://www.npmjs.com/package/@bella-baxter/sdk)
