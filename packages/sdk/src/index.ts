/**
 * @bella-baxter/sdk
 *
 * High-level client + config provider for the Bella Baxter secret management API.
 *
 * Exports:
 *   BaxterClient / createBaxterClient  — low-level API client (E2EE, HMAC auth)
 *   BellaConfig / createBellaConfig    — live-reloading secrets provider for Node.js
 *
 * For the full admin API surface (projects, environments, providers…)
 * use @bella-baxter/kiota-client directly.
 *
 * Prerequisites: run `apps/sdk/generate.sh` to populate kiota-client/src/generated/
 */

export * from './baxter-client.js';
export * from './config.js';

// Re-export E2EE types for consumers that need them directly
export { E2EKeyPair, isE2EPayload, type E2EEncryptedPayload } from './e2ee.js';
export { BellaClient } from '@bella-baxter/kiota-client';
export {
  BellaAuthenticationProvider,
  type BellaAuthOptions,
} from './auth-provider.js';
export { verifyWebhookSignature } from './webhook-signature.js';
