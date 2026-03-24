# Sample 07: Adonis.js v7

**Pattern:** SDK `BellaServiceProvider` registers `BellaService` in the IoC container.

> **Requires Node.js ≥ 22** (AdonisJS v7 uses `node:module` register API).  
> Use `nvm use 25` or ensure `node --version` is ≥ 22 before running.

## Setup

```bash
# Install from the JS SDK root (resolves workspace:* deps)
cd apps/sdk/js
pnpm install
```

### Authentication

**Option A — Human dev (OAuth, not billed, recommended):**
```bash
bella login
cd samples/07-adonisjs
bella exec -- npm run dev
```

**Option B — CI/CD (API key, billed per call):**
```bash
bella login --api-key bax-<keyId>-<secret>   # .bella auto-created with project + env
cd samples/07-adonisjs
bella exec -- npm run dev
```

> `BELLA_BAXTER_PROJECT` and `BELLA_BAXTER_ENV` are only needed if you're **not** using `bella exec` and have no `.bella` file.

## Register the provider

In `adonisrc.ts`, add the service provider:

```ts
// adonisrc.ts
import { defineConfig } from '@adonisjs/core/app';

export default defineConfig({
  providers: [
    // ... other providers
    () => import('@bella-baxter/config/adonis'),
  ],
});
```

Add `config/bella.ts` (already in this sample) — it's picked up automatically.

## How it works

`BellaServiceProvider` from `@bella-baxter/config/adonis`:
1. Runs `boot()` async — calls `BellaService.init()` before any HTTP requests
2. Registers `BellaService` as a singleton in the IoC container
3. Hooks `app.terminating()` for graceful shutdown
4. Background polling refreshes secrets without restart

```ts
// In any controller — inject BellaService
@inject()
export default class StripeController {
  constructor(private bella: BellaService) {}

  async createPayment({ request, response }: HttpContext) {
    const stripeKey = this.bella.config.get('STRIPE_SECRET_KEY');
    // stripe.charges.create(...)
  }
}
```
