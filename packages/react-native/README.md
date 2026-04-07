# @bella-baxter/react-native

[![npm](https://img.shields.io/npm/v/@bella-baxter/react-native)](https://www.npmjs.com/package/@bella-baxter/react-native)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Bella Baxter](https://github.com/Cosmic-Chimps/bella-baxter) SDK for React Native — encrypted local cache, live polling, and hooks for accessing secrets in your mobile app.

## Installation

```bash
npm install @bella-baxter/react-native @bella-baxter/sdk react-native-encrypted-storage
# or
pnpm add @bella-baxter/react-native @bella-baxter/sdk react-native-encrypted-storage
```

> `react-native-encrypted-storage` uses iOS Keychain / Android Keystore for the encrypted cache. It is a `peerDependency` — only required if you use `EncryptedStorageSecretCache`.

## Usage

### 1. Wrap your app in `BellaProvider`

```tsx
// App.tsx
import { BellaProvider, EncryptedStorageSecretCache } from '@bella-baxter/react-native';
import { createBaxterClient } from '@bella-baxter/sdk';

const client = createBaxterClient({
  baxterUrl: process.env.BELLA_BAXTER_URL!,
  apiKey: process.env.BELLA_BAXTER_API_KEY!,
});

export default function App() {
  return (
    <BellaProvider
      client={client}
      projectSlug="my-app"
      environmentSlug="production"
      cache={new EncryptedStorageSecretCache()}
      pollInterval={5 * 60 * 1000}  // 5 minutes (default)
    >
      <YourApp />
    </BellaProvider>
  );
}
```

### 2. Access secrets in any component

```tsx
import { useSecret, useSecrets } from '@bella-baxter/react-native';

function DatabaseStatus() {
  // Single secret with optional fallback
  const dbUrl = useSecret('DATABASE_URL', 'not set');

  // Full state object
  const { secrets, loading, offline, fromCache, refresh } = useSecrets();

  if (loading) return <Text>Loading...</Text>;
  if (offline)  return <Text>⚠️ Offline — showing cached secrets</Text>;

  return <Text>DB: {dbUrl}</Text>;
}
```

## Encrypted cache

`EncryptedStorageSecretCache` persists secrets between app launches using the device's secure storage (iOS Keychain / Android Keystore):

- **Startup**: serves cached secrets immediately while fresh secrets are fetched in the background
- **Offline**: falls back to cache when the API is unreachable
- **Update**: writes the cache after every successful fetch

You can supply a custom cache by implementing the `SecretCache` interface:

```ts
interface SecretCache {
  read(): Promise<Record<string, string> | null>;
  write(secrets: Record<string, string>): Promise<void>;
}
```

## Startup behaviour

1. Read from encrypted cache → immediate render with cached secrets
2. Fetch fresh secrets from API in background
3. On success → update state + write cache
4. On failure → keep cached secrets, set `offline = true`
5. Poll every `pollInterval` → repeat from step 2

## Links

- [GitHub](https://github.com/Cosmic-Chimps/bella-baxter)
- [Issues](https://github.com/Cosmic-Chimps/bella-baxter/issues)
- [Core SDK](https://www.npmjs.com/package/@bella-baxter/sdk)
