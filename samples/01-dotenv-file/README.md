# Sample 01: `.env` File Approach

**Pattern:** CLI writes secrets to a `.env` file → app reads it with `dotenv`.

This is the **simplest integration** and works with **any Node.js framework** — Express, Fastify, Koa, Hono, vanilla scripts, etc.

---

## How it works

```
bella secrets get -o .env   →   .env file on disk   →   dotenv.config()   →   process.env
```

The CLI fetches secrets via E2EE, writes them to `.env`, and your app loads them normally.

## Setup

```bash
# Install
npm install
```

### Authentication

**Human dev (OAuth — not billed, recommended):**
```bash
bella login          # opens browser; requires .bella file or -p/-e flags for project context
```

**CI/CD (API key — billed per call):**
```bash
bella login --api-key bax-<keyId>-<secret>   # key encodes project + env; .bella auto-created
```

> **Self-hosted Bella Baxter?** Also set: `export BELLA_BAXTER_URL=https://your-bella-instance.com`

```bash
# Pull secrets (before starting app)
bella secrets get -p my-project -e production -o .env
# Note: -p/-e flags are not needed when a .bella file is present in your directory
# (auto-created on API key login, or add one manually: echo "project=my-project\nenv=production" > .bella)

# Start app
node app.js
```

## One-liner for npm scripts

```json
{
  "scripts": {
    "start": "bella secrets get -p my-project -e production -o .env && node app.js",
    "dev": "bella secrets get -o .env && node app.js"
  }
}
```

> `-p`/`-e` flags can be omitted when a `.bella` file is present (or when using API key auth, which encodes project/env in the key).

## Works with any framework

Since secrets land in `process.env` via `dotenv`, **any framework** that reads `process.env` works:

```bash
# Express
bella secrets get -o .env && node server.js

# NestJS
bella secrets get -o .env && npm run start:prod

# Next.js (build-time secrets)
bella secrets get -o .env.local && next build && next start

# Python (cross-language)
bella secrets get -o .env && python app.py

# Docker (inject at container start)
bella secrets get -o .env && docker-compose up
```

## Security notes

- `.env` files should be in `.gitignore` — never commit secrets
- The file is only as secure as the filesystem — use for local dev and trusted CI environments
- For production with live reload, use the SDK approach (`@bella-baxter/config`)
