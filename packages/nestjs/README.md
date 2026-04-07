# @bella-baxter/nestjs

[![npm](https://img.shields.io/npm/v/@bella-baxter/nestjs)](https://www.npmjs.com/package/@bella-baxter/nestjs)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Bella Baxter](https://github.com/Cosmic-Chimps/bella-baxter) module for NestJS — registers `BellaConfigService` as a globally injectable service backed by live-reloading secrets.

## Installation

```bash
npm install @bella-baxter/nestjs @nestjs/common @nestjs/core
# or
pnpm add @bella-baxter/nestjs @nestjs/common @nestjs/core
```

## Setup

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { BellaModule } from '@bella-baxter/nestjs';

@Module({
  imports: [
    BellaModule.register({
      baxterUrl: process.env.BELLA_BAXTER_URL!,
      apiKey: process.env.BELLA_BAXTER_API_KEY!,
      projectSlug: 'my-app',         // or BELLA_BAXTER_PROJECT env var
      environmentSlug: 'production',  // or BELLA_BAXTER_ENV env var
    }),
  ],
})
export class AppModule {}
```

## Inject secrets

```ts
// your.service.ts
import { Injectable } from '@nestjs/common';
import { BellaConfigService } from '@bella-baxter/nestjs';

@Injectable()
export class YourService {
  constructor(private readonly bella: BellaConfigService) {}

  getDbUrl(): string {
    return this.bella.getOrThrow('DATABASE_URL');
  }
}
```

## Typed secrets

Run `bella secrets generate typescript --declaration` to generate `bella-secrets.d.ts`. The `BellaConfigService` proxy picks up the augmented `BellaSecrets` interface automatically:

```ts
this.bella.DATABASE_URL  // string — typed!
this.bella.PORT          // number — after adding coercions
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
