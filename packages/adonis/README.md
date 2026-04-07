# @bella-baxter/adonis

[![npm](https://img.shields.io/npm/v/@bella-baxter/adonis)](https://www.npmjs.com/package/@bella-baxter/adonis)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Bella Baxter](https://github.com/Cosmic-Chimps/bella-baxter) service provider for AdonisJS v6/v7 — registers `BellaService` in the IoC container for live-reloading secrets.

## Installation

```bash
npm install @bella-baxter/adonis
# or
pnpm add @bella-baxter/adonis
```

## Setup

### 1. Register the provider

```ts
// adonisrc.ts
import { defineConfig } from '@adonisjs/core/build/config.js';

export default defineConfig({
  providers: [
    () => import('@bella-baxter/adonis'),
  ],
});
```

### 2. Create the config file

```ts
// config/bella.ts
import env from '#start/env'
import type { BellaConfigOptions } from '@bella-baxter/adonis';

const bellaConfig: BellaConfigOptions = {
  baxterUrl: env.get('BELLA_BAXTER_URL'),
  apiKey: env.get('BELLA_BAXTER_API_KEY'),
  projectSlug: env.get('BELLA_BAXTER_PROJECT', 'my-app'),
  environmentSlug: env.get('BELLA_BAXTER_ENV', 'production'),
};

export default bellaConfig;
```

### 3. Inject in controllers / services

```ts
import { inject } from '@adonisjs/core';
import { BellaService } from '@bella-baxter/adonis';

@inject()
export default class SecretsController {
  constructor(protected bella: BellaService) {}

  async show() {
    return { dbUrl: this.bella.getOrThrow('DATABASE_URL') }
  }
}
```

## Typed secrets

Run `bella secrets generate typescript --declaration` to generate `bella-secrets.d.ts`. The `BellaService` proxy picks up the augmented `BellaSecrets` interface:

```ts
this.bella.DATABASE_URL  // string — typed!
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
