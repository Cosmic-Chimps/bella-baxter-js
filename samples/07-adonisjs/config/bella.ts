/**
 * config/bella.ts — Adonis.js Bella configuration
 * Loaded by BellaServiceProvider via app.config.get('bella')
 *
 * Required env vars:
 *   BELLA_BAXTER_URL  — Baxter API base URL (e.g. https://api.bella-baxter.io)
 *   BELLA_BAXTER_API_KEY  — your API key (bax-<keyId>-<secret>)
 */
import { BELLA_COERCIONS } from '../bella-coercions.js';

const bellaConfig = {
  baxterUrl: process.env.BELLA_BAXTER_URL ?? 'https://api.bella-baxter.io',
  apiKey: process.env.BELLA_BAXTER_API_KEY,
  // Optional: poll for changes every 60 seconds
  pollingInterval: 60_000,
  // Coerce typed secrets: PORT → number, booleans → boolean (from bella-secrets.ts)
  coercions: BELLA_COERCIONS,
};

export default bellaConfig;
