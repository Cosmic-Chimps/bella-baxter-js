# Sample 02: Process Inject (bella run)

**Pattern:** `bella run -- node app.js` — secrets are injected directly as env vars into the child process without touching the filesystem.

---

## How it works

```
bella run -- node app.js
  ↓
1. bella fetches secrets via E2EE from Baxter API
2. bella spawns: node app.js
3. child process receives { ...process.env, ...secrets }
4. child's stdout/stderr are inherited (no capture)
5. bella exits with the child's exit code
```

**No `.env` file is written.** Secrets live only in the child's env — safer than file approach.

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
# Run your app with secrets injected
bella run -p my-project -e production -- node app.js
# Note: -p/-e flags are not needed when a .bella file is present in your directory
```

## npm script integration

```json
{
  "scripts": {
    "start": "bella run -- node app.js",
    "dev": "bella run -- node --watch app.js",
    "test": "bella run -- jest"
  }
}
```

> Omit `-p`/`-e` when a `.bella` file is present or when using API key auth (project/env encoded in key).

## Works with any command

```bash
# Any Node.js framework
bella run -- npm start
bella run -- npx ts-node src/main.ts

# Python, Go, Ruby, etc.
bella run -- python manage.py runserver
bella run -- ./bin/server

# Docker Compose (secrets in compose container startup)
bella run -- docker-compose up

# Database migrations
bella run -e staging -- npx prisma migrate deploy
bella run -e staging -- npx sequelize-cli db:migrate
```

## vs. `.env` file approach

| | `bella secrets get -o .env` | `bella run --` |
|---|---|---|
| Secrets written to disk | ✅ Yes | ❌ No |
| Requires dotenv in app | ✅ Yes | ❌ No |
| Works with any command | ✅ Yes | ✅ Yes |
| Live reload | ❌ No | ❌ No |
| Secret security | File system | Memory only |
