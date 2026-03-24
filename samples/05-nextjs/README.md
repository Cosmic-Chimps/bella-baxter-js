# Sample 05: Next.js (App Router)

**Pattern:** Initialize via `instrumentation.ts` → read secrets in any API route / Server Component.

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
cd samples/05-nextjs
bella exec -- pnpm run dev
```

**Option B — CI/CD (API key, billed per call):**
```bash
bella login --api-key bax-<keyId>-<secret>   # .bella auto-created with project + env
cd samples/05-nextjs
bella exec -- pnpm run dev
```

> **Self-hosted Bella Baxter?** Also set: `export BELLA_BAXTER_URL=https://your-bella-instance.com`

> `BELLA_BAXTER_PROJECT` and `BELLA_BAXTER_ENV` are only needed if you're **not** using `bella exec` and have no `.bella` file.

## Test endpoints

| Endpoint | Response |
|---|---|
| `GET /api/health` | `{ "ok": true }` |
| `GET /api/secrets` | All 8 secrets as JSON (`PORT`, `DATABASE_URL`, `EXTERNAL_API_KEY`, `GLEAP_API_KEY`, `ENABLE_FEATURES`, `APP_ID`, `ConnectionStrings__Postgres`, `APP_CONFIG`) |

## How it works

1. `instrumentation.ts` runs once before Next.js starts serving (Node.js runtime only)
2. `initBella()` fetches secrets and starts background polling
3. In any API route or Server Component: `getBella().get('KEY')`

```ts
// app/api/users/route.ts
import { getBella } from '@bella-baxter/config/next';

export async function GET() {
  const dbUrl = getBella()!.get('DATABASE_URL');
  // connect to database...
}
```

```tsx
// app/dashboard/page.tsx (Server Component)
import { getBella } from '@bella-baxter/config/next';

export default async function DashboardPage() {
  const apiBase = getBella()!.get('BACKEND_API_URL');
  const data = await fetch(`${apiBase}/stats`).then(r => r.json());
  return <div>{JSON.stringify(data)}</div>;
}
```

## Edge Runtime

`initBella()` and `getBella()` are **Node.js only** — they use `fs`, `crypto`, and long-lived process state that the Edge runtime doesn't support. This is true for all secret manager SDKs (AWS, Vault, Azure, etc.).

**For edge routes, inject secrets at deploy/build time:**

```bash
# Fetch secrets as a .env file and use them as environment variables
bella secrets get -o .env.production

# Then deploy with those env vars available to your edge functions
# (e.g. add them to Vercel dashboard, or use in CI/CD pipeline)
```

Edge functions then read from `process.env` directly — no SDK needed.

