# Sample 03: Express.js

**Pattern:** SDK middleware (`req.bella`) with live secret polling.

## Setup

> **Note:** This sample uses `workspace:*` to reference the local `@bella-baxter/config` package.
> Install from the JS SDK root, not inside this directory.

```bash
# 1. Install from the JS SDK root (resolves workspace:* deps)
cd apps/sdk/js
pnpm install
```

### Authentication

**Option A — Human dev (OAuth, not billed, recommended):**
```bash
bella login                          # opens browser
cd samples/03-express
bella exec -- pnpm start             # bella injects credentials; SDK fetches secrets at startup
```

**Option B — CI/CD (API key, billed per call):**
```bash
bella login --api-key bax-<keyId>-<secret>   # .bella auto-created with project + env
cd samples/03-express
bella exec -- pnpm start
```

> **Self-hosted Bella Baxter?** Also set: `export BELLA_BAXTER_URL=https://your-bella-instance.com`

> `BELLA_BAXTER_PROJECT` and `BELLA_BAXTER_ENV` are only needed if you're **not** using `bella exec` and have no `.bella` file. `bella exec` injects all required credentials automatically.

## How it works

`createBellaMiddleware()` from `@bella-baxter/config/express`:
1. Loads secrets at startup (async — the `await` is required)
2. Attaches `req.bella` to every request — use `req.bella.get('KEY')` to read
3. Background polling refreshes secrets without restarting the server
4. E2EE is automatic — no `secretKey` needed

```js
app.get('/dashboard', async (req, res) => {
  // Read fresh secret on each request
  const token = req.bella.get('THIRD_PARTY_TOKEN');
  const data = await fetch(endpoint, { headers: { Authorization: token } });
  res.json(await data.json());
});
```
