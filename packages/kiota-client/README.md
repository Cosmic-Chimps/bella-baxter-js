# @bella-baxter/kiota-client

[![npm](https://img.shields.io/npm/v/@bella-baxter/kiota-client)](https://www.npmjs.com/package/@bella-baxter/kiota-client)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Kiota-generated TypeScript client for the full [Bella Baxter](https://github.com/Cosmic-Chimps/bella-baxter) REST API — projects, environments, providers, secrets, API keys, and more.

> **Most users should use [`@bella-baxter/sdk`](https://www.npmjs.com/package/@bella-baxter/sdk) instead.** It wraps this client with authentication, live-reloading, and ZKE support out of the box.

## Installation

```bash
npm install @bella-baxter/kiota-client
# or
pnpm add @bella-baxter/kiota-client
```

## Usage

This package is primarily consumed by `@bella-baxter/sdk` and the Bella CLI. For direct usage:

```ts
import { BellaClient } from '@bella-baxter/kiota-client';
import {
  FetchRequestAdapter,
  HttpClient,
} from '@microsoft/kiota-http-fetchlibrary';
import { BellaAuthenticationProvider } from '@bella-baxter/sdk';

const authProvider = new BellaAuthenticationProvider({
  apiKey: process.env.BELLA_BAXTER_API_KEY!,
});

const adapter = new FetchRequestAdapter(
  authProvider,
  undefined,
  undefined,
  new HttpClient(),
);
adapter.baseUrl = process.env.BELLA_BAXTER_URL!;

const client = new BellaClient(adapter);

// List projects
const projects = await client.api.v1.projects.get();

// Get secrets for an environment
const secrets = await client.api.v1
  .projects.byProjectSlug('my-app')
  .environments.byEnvironmentSlug('production')
  .secrets.get();
```

## Regenerating

The client is generated from the Bella Baxter OpenAPI spec. To regenerate after API changes:

```bash
cd apps/sdk
./generate.sh
```

## Links

- [GitHub](https://github.com/Cosmic-Chimps/bella-baxter)
- [Issues](https://github.com/Cosmic-Chimps/bella-baxter/issues)
- [Core SDK](https://www.npmjs.com/package/@bella-baxter/sdk)
