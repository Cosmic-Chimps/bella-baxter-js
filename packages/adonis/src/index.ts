/**
 * @bella-baxter/adonis
 *
 * Adonis.js v6 Service Provider — registers BellaConfig in the IoC container.
 *
 * @example
 * ```ts
 * // adonisrc.ts
 * import { defineConfig } from '@adonisjs/core/build/config.js';
 *
 * export default defineConfig({
 *   providers: [
 *     // ... other providers
 *     () => import('@bella-baxter/adonis'),
 *   ],
 * });
 * ```
 *
 * ```ts
 * // config/bella.ts
 * import env from '#start/env'
 *
 * const bellaConfig = {
 *   baxterUrl: env.get('BELLA_BAXTER_URL'),
 *   environmentSlug: env.get('BELLA_ENV_SLUG', 'production'),
 *   apiKey: env.get('BELLA_BAXTER_API_KEY'),
 *   
 * }
 *
 * export default bellaConfig
 * ```
 *
 * ```ts
 * // In any controller / service — inject via constructor
 * import BellaService from '@bella-baxter/adonis'
 *
 * export default class SecretsController {
 *   constructor(protected bella: BellaService) {}
 *
 *   async show() {
 *     return { dbUrl: this.bella.getOrThrow('DATABASE_URL') }
 *   }
 * }
 * ```
 */

import { BellaConfig, BellaSecrets, createBellaConfig, type BellaConfigOptions } from '@bella-baxter/sdk';

// ── Injectable Service ───────────────────────────────────────────────────────

/**
 * Thin injectable wrapper over BellaConfig with Adonis-style naming.
 * Registered as a singleton in the IoC container under 'bella'.
 *
 * After running `bella secrets generate typescript --declaration`, the generated
 * `bella-secrets.d.ts` augments `BellaSecrets`, giving this service typed property access:
 * ```ts
 * this.bella.DATABASE_URL  // string — typed!
 * ```
 */
export class BellaService {
  private readonly _inner: BellaConfig;

  constructor(config: BellaConfig) {
    this._inner = config;
    // Intercept property access so typed secret keys (e.g. this.bella.DATABASE_URL)
    // delegate to config.get() at runtime.
    return new Proxy(this, {
      get(target, key) {
        if (typeof key === 'symbol' || key in (BellaService.prototype as object) || key in target) {
          return Reflect.get(target, key);
        }
        return target._inner.get(key as string);
      },
    }) as BellaService;
  }

  get(key: string): string | undefined {
    return this._inner.get(key);
  }

  getOrThrow(key: string): string {
    return this._inner.getOrThrow(key);
  }

  getAll(): Record<string, string> {
    return this._inner.getAll();
  }

  /** Write all secrets into process.env (useful for legacy Adonis code). */
  intoProcessEnv(): void {
    this._inner.intoProcessEnv();
  }

  shutdown(): void {
    this._inner.destroy();
  }
}

// Interface merging: when bella-secrets.d.ts augments BellaSecrets, those properties
// are also visible on BellaService (backed by the Proxy at runtime).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BellaService extends BellaSecrets {}

// ── Service Provider ─────────────────────────────────────────────────────────

/**
 * BellaServiceProvider for Adonis.js v6/v7.
 *
 * Registers `BellaService` in the container during `boot()`.
 * Uses the config from `config/bella.ts`.
 *
 * Bound by class constructor so `@inject()` can resolve it via TypeScript
 * decorator metadata (`design:paramtypes`).
 */
export default class BellaServiceProvider {
  constructor(protected app: {
    config: { get: <T>(key: string, defaultValue?: T) => T };
    container: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      singleton: (key: any, factory: () => unknown) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      make: (key: any) => unknown;
    };
    terminating: (cb: () => void | Promise<void>) => void;
  }) {}

  async boot(): Promise<void> {
    const options = this.app.config.get<BellaConfigOptions>('bella');

    // Register by class so @inject() can resolve by design:paramtypes.
    this.app.container.singleton(BellaService, () =>
      createBellaConfig(options).then((cfg) => new BellaService(cfg)),
    );

    this.app.terminating(() => {
      const service = this.app.container.make(BellaService) as BellaService;
      service.shutdown();
    });
  }
}

export { BellaConfig, type BellaConfigOptions };
