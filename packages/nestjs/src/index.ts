/**
 * @bella-baxter/nestjs
 *
 * NestJS DI module — provides BellaConfig as an injectable service.
 *
 * @example
 * ```ts
 * // app.module.ts
 * import { BellaModule } from '@bella-baxter/nestjs';
 *
 * @Module({
 *   imports: [
 *     BellaModule.register({
 *       baxterUrl: process.env.BELLA_BAXTER_URL!,
 *       apiKey: process.env.BELLA_BAXTER_API_KEY!,
 *       
 *     }),
 *   ],
 * })
 * export class AppModule {}
 *
 * // your.service.ts
 * import { BellaConfigService } from '@bella-baxter/nestjs';
 *
 * @Injectable()
 * export class YourService {
 *   constructor(private readonly bella: BellaConfigService) {}
 *
 *   getDbUrl(): string {
 *     return this.bella.getOrThrow('DATABASE_URL');
 *   }
 * }
 * ```
 */

import { type DynamicModule, Module, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { BellaConfig, BellaSecrets, createBellaConfig, type BellaConfigOptions } from '@bella-baxter/sdk';

export const BELLA_CONFIG = Symbol('BELLA_CONFIG');

/**
 * Injectable wrapper — thin proxy over BellaConfig with NestJS lifecycle hooks.
 *
 * After running `bella secrets generate typescript --declaration`, the generated
 * `bella-secrets.d.ts` augments `BellaSecrets`, giving this service typed property access:
 * ```ts
 * this.bella.DATABASE_URL  // string — typed!
 * ```
 */
@Injectable()
export class BellaConfigService implements OnModuleDestroy {
  private readonly _inner: BellaConfig;

  constructor(config: BellaConfig) {
    this._inner = config;
    // Intercept property access so typed secret keys (e.g. this.bella.DATABASE_URL)
    // delegate to config.get() at runtime.
    return new Proxy(this, {
      get(target, key) {
        if (typeof key === 'symbol' || key in (BellaConfigService.prototype as object) || key in target) {
          return Reflect.get(target, key);
        }
        return target._inner.get(key as string);
      },
    }) as BellaConfigService;
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

  onModuleDestroy(): void {
    this._inner.destroy();
  }
}

// Interface merging: when bella-secrets.d.ts augments BellaSecrets, those properties
// are also visible on BellaConfigService (backed by the Proxy at runtime).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BellaConfigService extends BellaSecrets {}

@Module({})
export class BellaModule {
  /**
   * Register BellaModule synchronously with inline options.
   * Bella secrets are loaded during module initialisation (onModuleInit).
   */
  static register(options: BellaConfigOptions): DynamicModule {
    return {
      module: BellaModule,
      global: true, // available across all modules without re-importing
      providers: [
        {
          provide: BELLA_CONFIG,
          useFactory: () => createBellaConfig(options),
        },
        {
          provide: BellaConfigService,
          useFactory: (config: BellaConfig) => new BellaConfigService(config),
          inject: [BELLA_CONFIG],
        },
      ],
      exports: [BellaConfigService],
    };
  }
}
