import { BaxterClient, type BellaSdkOptions } from '@bella-baxter/sdk';

// ── BellaSecrets interface ────────────────────────────────────────────────────

/**
 * Global interface augmented by `bella secrets generate typescript --declaration`.
 *
 * Declaring `BellaSecrets` in the global scope means any `.d.ts` file included in
 * your tsconfig can extend it **without needing an import** in every route/controller.
 *
 * After running the command, two files are generated:
 *
 * ```ts
 * // bella-secrets.d.ts (ambient — TypeScript picks up globally, safe to commit)
 * declare global {
 *   interface BellaSecrets {
 *     DATABASE_URL: string;
 *     PORT: number;   // int type → TS number, Proxy coerces at runtime
 *   }
 * }
 *
 * // bella-coercions.ts (runtime — import once in your framework setup)
 * export const BELLA_COERCIONS = { PORT: 'number' } as const ...;
 * ```
 *
 * Pass `BELLA_COERCIONS` to `createBellaConfig()` to enable runtime coercion:
 * ```ts
 * import { BELLA_COERCIONS } from './bella-coercions.js';
 * const bella = await createBellaConfig({ coercions: BELLA_COERCIONS });
 * bella.PORT  // number (8080), not string "8080"
 * ```
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface BellaSecrets {}
}
// Export the global interface so adapters can import it explicitly.
export type { BellaSecrets };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BellaConfigOptions extends BellaSdkOptions {
  /**
   * Project slug (e.g. "my-app", "backend").
   * Falls back to BELLA_BAXTER_PROJECT env var (or BELLA_PROJECT, deprecated), then to .bella file in cwd (walks up).
   */
  projectSlug?: string;
  /**
   * Environment slug (e.g. "production", "staging").
   * Falls back to BELLA_BAXTER_ENV env var (or BELLA_ENV, deprecated), then to .bella file in cwd (walks up).
   */
  environmentSlug?: string;
  /**
   * How often to poll Baxter for changes in milliseconds (default: 60_000).
   *
   * Cost note: Baxter serves from Redis HybridCache — cloud providers
   * (AWS/Azure/GCP) are only hit on cache miss or secret mutation, not per poll.
   */
  pollingInterval?: number;
  /**
   * If true, keep serving stale secrets when Baxter is temporarily unreachable.
   * Default: true — prevents app crash on network hiccup.
   */
  fallbackOnError?: boolean;
  /**
   * Optional key prefix to strip. E.g. prefix "MYAPP_" turns "MYAPP_DB_URL" → "DB_URL".
   */
  keyPrefix?: string;
  /** Called whenever secrets change. Use for cache invalidation, reconnections, etc. */
  onUpdate?: (changes: SecretChange[]) => void | Promise<void>;
  /**
   * Runtime coercion map — exported by the generated `bella-secrets.ts` as `BELLA_COERCIONS`.
   *
   * Maps secret key names to their expected JS type so the Proxy can coerce raw string
   * values from the API into proper `number` or `boolean` values at runtime.
   *
   * ```ts
   * import { BELLA_COERCIONS } from './bella-secrets.js';
   *
   * const bella = await createBellaConfig({
   *   coercions: BELLA_COERCIONS,  // PORT becomes 8080 (number), not "8080"
   * });
   * ```
   */
  coercions?: Record<string, 'number' | 'boolean'>;
  /**
   * Optional name of your application, sent as X-App-Client header for audit logging.
   * Falls back to BELLA_BAXTER_APP_CLIENT env var if set, otherwise not sent.
   * Example: "my-express-api", "github-ci-deploy", "data-pipeline"
   */
  client?: string;
}

export interface SecretChange {
  key: string;
  oldValue: string | undefined;
  newValue: string | undefined;
}

// ── Core provider ─────────────────────────────────────────────────────────────

/** Resolved options — projectSlug and environmentSlug are guaranteed non-empty. */
type ResolvedBellaConfigOptions = BellaConfigOptions &
  Required<Pick<BellaConfigOptions, 'projectSlug' | 'environmentSlug'>>;

export class BellaConfig {
  private readonly client: BaxterClient;
  private readonly options: Required<
    Pick<ResolvedBellaConfigOptions, 'projectSlug' | 'environmentSlug' | 'pollingInterval' | 'fallbackOnError'>
  > &
    ResolvedBellaConfigOptions;

  private secrets: Record<string, string> = {};
  private currentVersion = -1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private loaded = false;

  constructor(options: ResolvedBellaConfigOptions) {
    this.client = new BaxterClient({ ...options, appClient: options.client ?? options.appClient });
    this.options = {
      pollingInterval: 60_000,
      fallbackOnError: true,
      ...options,
    };
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Load secrets and start polling. Must be called before get(). */
  async load(): Promise<void> {
    await this.client.init();
    await this.fetchSecrets();
    this.loaded = true;
    this.timer = setInterval(() => void this.poll(), this.options.pollingInterval);
    // Keep Node.js from hanging on the interval if the app shuts down
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((this.timer as any).unref) (this.timer as any).unref();
  }

  /** Stop polling and release resources. */
  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Get a single secret value. */
  get(key: string): string | undefined {
    return this.secrets[key];
  }

  /** Get a single secret, throwing if missing. */
  getOrThrow(key: string): string {
    const val = this.secrets[key];
    if (val === undefined)
      throw new Error(`[Bella] Secret "${key}" not found in environment "${this.options.environmentSlug}"`);
    return val;
  }

  /** Get all secrets as a plain object. */
  getAll(): Record<string, string> {
    return { ...this.secrets };
  }

  /**
   * Write all secrets into process.env.
   * Useful for legacy code that reads directly from process.env,
   * or for frameworks that don't support a DI-based config provider.
   *
   * ⚠️  Changes to process.env are NOT hot-reloaded — call this again
   *     inside onUpdate() if you need live updates there.
   */
  intoProcessEnv(): void {
    for (const [key, value] of Object.entries(this.secrets)) {
      process.env[key] = value;
    }
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    try {
      // Lightweight version check first
      if (this.currentVersion >= 0) {
        const versionResp = await this.client.getSecretsVersion(this.options.projectSlug, this.options.environmentSlug);
        if (versionResp.version === this.currentVersion) return; // nothing changed
      }
      await this.fetchSecrets();
    } catch (err) {
      if (!this.options.fallbackOnError) throw err;
      console.warn('[Bella] Poll failed, keeping cached secrets:', (err as Error).message);
    }
  }

  private async fetchSecrets(): Promise<void> {
    const resp = await this.client.getAllSecrets(this.options.projectSlug, this.options.environmentSlug);
    const newSecrets = this.applyKeyPrefix(resp.secrets);
    const changes = this.detectChanges(newSecrets);

    this.secrets = newSecrets;
    this.currentVersion = resp.version;

    if (changes.length > 0 && this.loaded) {
      await this.options.onUpdate?.(changes);
    }
  }

  private applyKeyPrefix(secrets: Record<string, string>): Record<string, string> {
    const prefix = this.options.keyPrefix;
    if (!prefix) return secrets;
    return Object.fromEntries(
      Object.entries(secrets).map(([k, v]) => [
        k.toLowerCase().startsWith(prefix.toLowerCase()) ? k.slice(prefix.length) : k,
        v,
      ]),
    );
  }

  private detectChanges(newSecrets: Record<string, string>): SecretChange[] {
    const changes: SecretChange[] = [];
    const allKeys = new Set([...Object.keys(this.secrets), ...Object.keys(newSecrets)]);
    for (const key of allKeys) {
      const oldValue = this.secrets[key];
      const newValue = newSecrets[key];
      if (oldValue !== newValue) changes.push({ key, oldValue, newValue });
    }
    return changes;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create and load a BellaConfig instance.
 *
 * @example
 * ```ts
 * // Works in Express, NestJS, Next.js, Fastify, Hono — any Node.js app
 * const bella = await createBellaConfig({
 *   baxterUrl: process.env.BELLA_BAXTER_URL!,
 *   projectSlug: process.env.BELLA_BAXTER_PROJECT!,
 *   environmentSlug: process.env.BELLA_BAXTER_ENV!,
 *   apiKey: process.env.BELLA_BAXTER_API_KEY!,
 *   
 *   onUpdate: (changes) => console.log('Secrets changed:', changes.map(c => c.key)),
 * });
 *
 * bella.get('DATABASE_URL')       // → string | undefined
 * bella.getOrThrow('DATABASE_URL') // → string (throws if missing)
 * bella.getAll()                   // → Record<string, string>
 * bella.intoProcessEnv()           // → writes to process.env
 * ```
 */
export async function createBellaConfig(options: BellaConfigOptions): Promise<BellaConfig & BellaSecrets> {
  // Resolve projectSlug: option → BELLA_BAXTER_PROJECT → BELLA_PROJECT (deprecated) → BELLA_BAXTER_CONTEXT → BELLA_CONTEXT (deprecated) → .bella file → API key discovery
  let projectSlug = options.projectSlug
    || process.env['BELLA_BAXTER_PROJECT']
    || process.env['BELLA_PROJECT']                       // deprecated
    || process.env['BELLA_BAXTER_CONTEXT']?.split('/')[0]
    || process.env['BELLA_CONTEXT']?.split('/')[0];       // deprecated
  let environmentSlug = options.environmentSlug
    || process.env['BELLA_BAXTER_ENV']
    || process.env['BELLA_ENV']                           // deprecated
    || process.env['BELLA_BAXTER_CONTEXT']?.split('/')[1]
    || process.env['BELLA_CONTEXT']?.split('/')[1];       // deprecated

  // Final fallback: ask the API "which project/env does this key belong to?"
  // Only works in API key mode — skip if we're in JWT (accessToken) mode since
  // /api/v1/keys/me is not meaningful for OAuth users.
  const hasApiKey = !!(options.apiKey || (typeof process !== 'undefined' && process.env['BELLA_BAXTER_API_KEY']));
  if ((!projectSlug || !environmentSlug) && hasApiKey) {
    try {
      const discovery = new BaxterClient(options as BellaSdkOptions);
      const ctx = await discovery.discoverContext();
      projectSlug = projectSlug || ctx.projectSlug;
      environmentSlug = environmentSlug || ctx.environmentSlug;
    } catch (err) {
      // Discovery failed — fall through to the friendly error below
    }
  }

  if (!projectSlug) {
    throw new Error(
      'Bella project slug is missing.\n' +
      '  Options (in priority order):\n' +
      '    1. Pass projectSlug to createBellaConfig() / createBellaMiddleware()\n' +
      '    2. Set BELLA_BAXTER_PROJECT environment variable\n' +
      '    3. The API key is not scoped to a project (use a Consumer key, not a Manager key)',
    );
  }
  if (!environmentSlug) {
    throw new Error(
      'Bella environment slug is missing.\n' +
      '  Options (in priority order):\n' +
      '    1. Pass environmentSlug to createBellaConfig() / createBellaMiddleware()\n' +
      '    2. Set BELLA_BAXTER_ENV environment variable\n' +
      '    3. The API key is not scoped to an environment (use a Consumer key)',
    );
  }

  const config = new BellaConfig({ ...options, projectSlug, environmentSlug });
  await config.load();
  const secretCount = Object.keys(config.getAll()).length;
  console.info(`[BellaBaxter] Loaded ${secretCount} secret(s) from project '${projectSlug}' / environment '${environmentSlug}'`);
  const coercions = options.coercions ?? {};
  // Wrap in Proxy so typed property access (e.g. bella.DATABASE_URL) delegates to .get(key)
  // at runtime. Types are provided by the generated bella-secrets.ts module augmentation.
  // The coercions map (from BELLA_COERCIONS) ensures int/bool keys are returned as
  // number/boolean rather than raw strings.
  return new Proxy(config, {
    get(target: BellaConfig, key: string | symbol) {
      if (typeof key === 'symbol' || key in target) return Reflect.get(target, key);
      const raw = target.get(key as string);
      if (raw === undefined) return undefined;
      const coercion = coercions[key as string];
      if (coercion === 'number') return Number(raw);
      if (coercion === 'boolean') return raw === 'true' || raw === '1';
      return raw;
    },
  }) as BellaConfig & BellaSecrets;
}
