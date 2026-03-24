import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { BaxterClient } from '@bella-baxter/sdk';
import type { SecretCache } from './cache.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BellaProviderProps {
  /** Configured BaxterClient from @bella-baxter/sdk. */
  client: BaxterClient;

  /** Project slug (e.g. 'my-app'). Required. */
  projectSlug: string;

  /** Environment slug (e.g. 'production'). Required. */
  environmentSlug: string;

  /**
   * Encrypted cache implementation.
   * Recommended: EncryptedStorageSecretCache (iOS Keychain / Android Keystore).
   * When provided:
   *   - Secrets are written after every successful fetch.
   *   - On startup offline: cached secrets are served immediately.
   */
  cache?: SecretCache;

  /**
   * How often to re-fetch secrets in the background.
   * Default: 5 minutes. Set to 0 to disable polling.
   */
  pollInterval?: number;

  /** Your app tree. */
  children: React.ReactNode;
}

export interface SecretsState {
  /** Current secrets map. Empty object until first fetch or cache read. */
  secrets: Record<string, string>;
  /** True while the very first load is happening and the cache is empty. */
  loading: boolean;
  /** True when the last fetch failed (offline or API error). */
  offline: boolean;
  /** True when secrets came from the encrypted cache (no fresh fetch yet). */
  fromCache: boolean;
  /** Manually trigger a fresh fetch. */
  refresh: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const BellaContext = createContext<SecretsState | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * BellaProvider — wraps your app and makes secrets available to any child
 * component via useSecrets() or useSecret(key).
 *
 * ```tsx
 * // App.tsx
 * import { BellaProvider } from '@bella-baxter/react-native';
 * import { BaxterClient } from '@bella-baxter/sdk';
 * import { EncryptedStorageSecretCache } from '@bella-baxter/react-native';
 *
 * const client = new BaxterClient({
 *   baxterUrl: process.env.BELLA_BAXTER_URL!,
 *   apiKey: process.env.BELLA_BAXTER_API_KEY!,
 * });
 *
 * export default function App() {
 *   return (
 *     <BellaProvider client={client} cache={new EncryptedStorageSecretCache()}>
 *       <YourApp />
 *     </BellaProvider>
 *   );
 * }
 * ```
 *
 * Startup behaviour:
 *   1. Read from encrypted cache → immediate render with cached secrets
 *   2. Fetch fresh secrets from API in background
 *   3. On success → update state + write cache
 *   4. On failure → keep cached secrets, set offline=true
 *   5. Poll every pollInterval → repeat from step 2
 */
export function BellaProvider({
  client,
  projectSlug,
  environmentSlug,
  cache,
  pollInterval = DEFAULT_POLL_INTERVAL,
  children,
}: BellaProviderProps) {
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const fetchSecrets = useCallback(async () => {
    try {
      const fresh = await client.getAllSecrets(projectSlug, environmentSlug);
      if (!mountedRef.current) return;
      const map = fresh.secrets ?? {};
      setSecrets(map);
      setOffline(false);
      setFromCache(false);
      setLoading(false);
      await cache?.write(map);
    } catch {
      if (!mountedRef.current) return;
      setOffline(true);
      setLoading(false);
    }
  }, [client, projectSlug, environmentSlug, cache]);

  // Initial load: read cache first (instant), then fetch in background.
  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      if (cache) {
        try {
          const cached = await cache.read();
          if (cached && Object.keys(cached).length > 0 && mountedRef.current) {
            setSecrets(cached);
            setFromCache(true);
            setLoading(false);
          }
        } catch {
          // Cache unreadable — proceed to fetch.
        }
      }
      await fetchSecrets();
    }

    void init();
    return () => {
      mountedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling.
  useEffect(() => {
    if (!pollInterval) return;

    function schedule() {
      timerRef.current = setTimeout(async () => {
        await fetchSecrets();
        schedule();
      }, pollInterval);
    }

    schedule();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchSecrets, pollInterval]);

  const refresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void fetchSecrets();
  }, [fetchSecrets]);

  return (
    <BellaContext.Provider value={{ secrets, loading, offline, fromCache, refresh }}>
      {children}
    </BellaContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Returns the full secrets state from the nearest BellaProvider.
 *
 * ```tsx
 * const { secrets, offline, loading } = useSecrets();
 * ```
 */
export function useSecrets(): SecretsState {
  const ctx = useContext(BellaContext);
  if (!ctx) {
    throw new Error('useSecrets() must be called inside a <BellaProvider>.');
  }
  return ctx;
}

/**
 * Returns the value of a single secret, or a fallback if not set.
 *
 * ```tsx
 * const dbUrl = useSecret('DATABASE_URL', 'postgres://localhost/dev');
 * ```
 */
export function useSecret(key: string, fallback = ''): string {
  const { secrets } = useSecrets();
  return secrets[key] ?? fallback;
}
