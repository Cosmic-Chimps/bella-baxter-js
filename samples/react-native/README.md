# Sample: React Native + Bella Baxter

Shows the recommended pattern for React Native apps — one `<BellaProvider>` at the root,
secrets available anywhere via `useSecret(key)` or `useSecrets()`.

## Install

```bash
npm install @bella-baxter/sdk @bella-baxter/react-native react-native-encrypted-storage
npx pod-install          # iOS only
```

## Credentials

React Native bundles run in-process (no env vars at runtime). Pass credentials
at build time via your CI/CD pipeline or a secure config service. For development:

```bash
# .env (never commit)
BELLA_BAXTER_API_KEY=bax-...
BELLA_BAXTER_URL=https://baxter.example.com

# With react-native-dotenv or babel-plugin-transform-inline-environment-variables
```

## Behaviour

| Condition | Result |
|---|---|
| Online, first launch | Fetch → write cache → render |
| Online, subsequent launches | Read cache (instant) → fetch in background → update |
| Offline, cache exists | Read cache → render (offline banner shown) |
| Offline, no cache | Render with empty secrets |
| Connection restored | Next poll interval auto-refreshes |
