/**
 * @bella-baxter/next
 *
 * Next.js integration — load secrets once in instrumentation.ts and
 * access them anywhere in server components / API routes.
 *
 * @example
 * ```ts
 * // instrumentation.ts  (Next.js 14+ / App Router)
 * import { initBella } from '@bella-baxter/next';
 *
 * export async function register() {
 *   await initBella({
 *     baxterUrl: process.env.BELLA_BAXTER_URL!,
 *     apiKey: process.env.BELLA_BAXTER_API_KEY!,
 *   });
 * }
 *
 * // app/api/route.ts  (any server component or route handler)
 * import { getBella } from '@bella-baxter/next';
 *
 * export async function GET() {
 *   const bella = getBella();
 *   return Response.json({ db: bella.DATABASE_URL });
 * }
 * ```
 *
 * ⚠️  Only works in the Node.js runtime (not Edge runtime).
 *     For Edge routes, fetch secrets at deploy time:
 *       bella secrets get -o .env.production
 *     then read from process.env in your edge functions.
 */

// NOTE: No static import of '../index.js' here.
//
// Next.js 16 statically analyses instrumentation.ts for BOTH Node.js and Edge runtimes.
// If we statically import '../index.js' (which uses fs/path/crypto), the edge bundler
// emits noisy "Node.js module not supported in Edge Runtime" warnings even though the
// code is guarded by process.env.NEXT_RUNTIME !== 'edge' at runtime.
//
// Using a dynamic import inside initBella() means the edge bundler never traces into
// the Node.js-only modules, eliminating the warnings entirely.
import type { BellaConfig, BellaSecrets, BellaConfigOptions } from '@bella-baxter/sdk';

// Store singleton on `process` (NOT `globalThis`).
//
// Next.js RSC bundles run through webpack which replaces `globalThis` with its own
// polyfill object — a value set on `globalThis` in instrumentation.ts is NOT visible
// in the RSC route bundle. `process` is the real Node.js process object and is never
// polyfilled by webpack for server-side bundles, making it a reliable cross-bundle carrier.
const PROCESS_KEY = '__bella_baxter_instance__';

function getInstance(): (BellaConfig & BellaSecrets) | null {
  return (process as unknown as Record<string, unknown>)[PROCESS_KEY] as (BellaConfig & BellaSecrets) | null ?? null;
}

function setInstance(val: BellaConfig & BellaSecrets): void {
  (process as unknown as Record<string, unknown>)[PROCESS_KEY] = val;
}

/**
 * Initialize Bella secrets. Call this once from `instrumentation.ts`.
 * Starts the polling timer in the background.
 */
export async function initBella(options: BellaConfigOptions): Promise<BellaConfig & BellaSecrets> {
  if (getInstance()) {
    console.warn('[Bella] initBella() called more than once — reusing existing instance.');
    return getInstance()!;
  }
  // Dynamic import keeps Node.js-only modules (fs, path, crypto) out of the
  // edge bundler's static analysis path, preventing spurious edge-runtime warnings.
  const { createBellaConfig } = await import('@bella-baxter/sdk');
  const instance = await createBellaConfig(options);
  setInstance(instance);
  return instance;
}

/**
 * Get the initialized BellaConfig instance.
 * Throws if initBella() has not been called yet.
 */
export function getBella(): BellaConfig & BellaSecrets {
  const instance = getInstance();
  if (!instance)
    throw new Error('[Bella] getBella() called before initBella(). Check instrumentation.ts.');
  return instance;
}

/** Direct shorthand: bella('DATABASE_URL') */
export function bella(key: string): string | undefined {
  return getBella().get(key);
}

export type { BellaConfig, BellaSecrets, BellaConfigOptions };
