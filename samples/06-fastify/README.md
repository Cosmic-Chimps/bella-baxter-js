# Sample 06: Fastify

**Pattern:** `createBellaConfig` loads secrets at startup and decorates the Fastify instance with `app.bella`.

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
cd samples/06-fastify
bella exec -- pnpm run dev
```

**Option B — CI/CD (API key, billed per call):**
```bash
bella login --api-key bax-<keyId>-<secret>   # .bella auto-created with project + env
cd samples/06-fastify
bella exec -- pnpm run dev
```

> **Self-hosted Bella Baxter?** Also set: `export BELLA_BAXTER_URL=https://your-bella-instance.com`

> `BELLA_BAXTER_PROJECT` and `BELLA_BAXTER_ENV` are only needed if you're **not** using `bella exec` and have no `.bella` file.

## How it works

`createBellaConfig()` from `@bella-baxter/config`:
1. Loads secrets at startup (async — awaited before server starts)
2. Returns a `BellaConfig` instance decorated onto `app.bella`
3. Background polling refreshes secrets without restart
4. E2EE is automatic — no `secretKey` needed

> Note: There is no dedicated Fastify plugin adapter. `createBellaConfig` works with any Node.js framework — just call it once at startup and access via a module-level variable or framework decoration.

```ts
// In any route handler — access via the fastify instance
app.get('/dashboard', async (req, reply) => {
  const token = app.bella.get('ANALYTICS_TOKEN');
  const data = await fetch(analyticsEndpoint, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.json();
});
```
