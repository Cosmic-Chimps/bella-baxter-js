/**
 * instrumentation.ts
 *
 * Next.js runs this file before the app starts (both App Router and Pages Router).
 * Initialize Bella here so secrets are available before any route handler runs.
 *
 * Required env vars:
 *   BELLA_BAXTER_URL  — Baxter API base URL (e.g. https://api.bella-baxter.io)
 *   BELLA_BAXTER_API_KEY  — your API key (bax-<keyId>-<secret>)
 */

import { initBella } from '@bella-baxter/config/next';
import { BELLA_COERCIONS } from './bella-coercions';

export async function register() {
  // Only runs on the Node.js server (skip edge runtime).
  // Use !== 'edge' instead of === 'nodejs' because in dev mode NEXT_RUNTIME
  // may be undefined during the instrumentation phase, causing initBella() to
  // silently not run when the strict equality check is used.
  if (process.env.NEXT_RUNTIME !== 'edge') {
    await initBella({
      baxterUrl: process.env.BELLA_BAXTER_URL ?? 'https://api.bella-baxter.io',
      apiKey: process.env.BELLA_BAXTER_API_KEY!,
      // Optional: poll for changes every 60 seconds
      pollingInterval: 60_000,
      // Coerce typed secrets: PORT → number, booleans → boolean (from bella-secrets.ts)
      coercions: BELLA_COERCIONS,
    });
  }
}
