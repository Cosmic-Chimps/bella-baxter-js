# Sample 04: NestJS

**Pattern:** SDK `BellaModule` + `BellaConfigService` with live secret polling.

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
cd samples/04-nestjs
bella exec -- pnpm run dev
```

**Option B — CI/CD (API key, billed per call):**
```bash
bella login --api-key bax-<keyId>-<secret>   # .bella auto-created with project + env
cd samples/04-nestjs
bella exec -- pnpm run dev
```

> **Self-hosted Bella Baxter?** Also set: `export BELLA_BAXTER_URL=https://your-bella-instance.com`

> `BELLA_BAXTER_PROJECT` and `BELLA_BAXTER_ENV` are only needed if you're **not** using `bella exec` and have no `.bella` file.

## How it works

`BellaModule.register()` from `@bella-baxter/config/nestjs`:
1. Registers `BellaConfigService` as a global NestJS provider
2. Initialized on application start (via `OnModuleInit`)
3. Inject `BellaConfigService` anywhere with constructor DI
4. Background polling refreshes secrets without restart

```ts
@Injectable()
export class MyService {
  constructor(private bella: BellaConfigService) {}

  async doWork() {
    const apiKey = this.bella.get('THIRD_PARTY_API_KEY');
    // apiKey is always fresh — polling handles rotation
  }
}
```
