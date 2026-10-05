/**
 * e2ee-response.ts — #1050 (b): a presented E2EE key requires an envelope.
 *
 * Once this SDK has sent `X-E2E-Public-Key` on a read that carries secret VALUES, a 2xx answer that is
 * not a decryptable envelope is an ERROR, never a value. A header-stripping intermediary, a terminating
 * proxy or a server regression would otherwise hand the caller unencrypted secrets it believes were
 * end-to-end encrypted; a tampered or mis-keyed envelope would otherwise surface as a crypto exception
 * with no stable identity. There is no plaintext fallback and no opt-out: a client that does not want
 * to require an envelope must not present the key.
 *
 * The rule, the paths and the two codes are the cross-SDK contract in apps/sdk/SDK_CONTRACT.md
 * ("Rule: a presented key requires an envelope"); every SDK raises the same codes with the same message.
 */

import type { E2EEncryptedPayload, E2EKeyPair } from './e2ee.js';

/** A 2xx answer to an envelope-required read was not an envelope (plain secrets, or not JSON at all). */
export const E2EE_PLAINTEXT_RESPONSE = 'e2ee-plaintext-response' as const;
/** An envelope came back but would not open: a field missing/undecodable, a failed GCM tag, another key. */
export const E2EE_DECRYPTION_FAILED = 'e2ee-decryption-failed' as const;

export type E2EEResponseErrorCode = typeof E2EE_PLAINTEXT_RESPONSE | typeof E2EE_DECRYPTION_FAILED;

/**
 * A secrets response was refused because it was not a decryptable E2EE envelope although this client
 * presented its key. The message names the path and the code, never the body, ciphertext or key material;
 * the underlying crypto failure, when there is one, is `cause`.
 */
export class E2EEResponseError extends Error {
  /** Stable, cross-SDK code: {@link E2EE_PLAINTEXT_RESPONSE} or {@link E2EE_DECRYPTION_FAILED}. */
  readonly code: E2EEResponseErrorCode;
  /** The request path the refused response answered. */
  readonly path: string;
  /** The crypto/parse failure behind an `e2ee-decryption-failed`, if any. */
  readonly cause?: unknown;

  constructor(code: E2EEResponseErrorCode, path: string, cause?: unknown) {
    super(
      code === E2EE_PLAINTEXT_RESPONSE
        ? `E2EE response expected but plaintext received for ${path}; refusing it (${code})`
        : `E2EE response could not be decrypted for ${path}; refusing it (${code})`,
    );
    this.name = 'E2EEResponseError';
    this.code = code;
    this.path = path;
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * True when a 2xx answer to this request MUST be an E2EE envelope because the server encrypts it to a
 * presented key: the GETs that carry secret values. Everything else under `/secrets` (writes, `/version`,
 * `/manifest`, `/hash`, `/{key}/metadata`, `/{key}/versions`, …) is answered in plain JSON and keeps
 * passing through. Single author of that list for this SDK — mirror of SDK_CONTRACT.md.
 */
export function requiresEnvelope(method: string, path: string): boolean {
  if (method.toUpperCase() !== 'GET') return false;
  const bare = path.split(/[?#]/, 1)[0];
  const marker = '/api/v1/projects/';
  const at = bare.indexOf(marker);
  if (at < 0) return false;
  const segs = bare.slice(at + marker.length).split('/');
  if (segs.length < 2 || segs[0] === '') return false;
  const r = segs.slice(1);
  if (r.some((s) => s === '')) return false;

  if (r.length === 1) return r[0] === 'secrets'; // listGlobalSecrets
  if (r[0] !== 'environments') return false;
  if (r.length === 3) return r[2] === 'secrets'; // getAllEnvironmentSecrets
  if (r.length === 4 && r[2] === 'secrets') return r[3] === 'export'; // exportEnvironmentSecrets
  if (r[2] !== 'providers' || r.length < 5 || r[4] !== 'secrets') return false;
  if (r.length === 5) return true; // listSecrets
  if (r.length === 6) return r[5] !== 'hash'; // exportSecrets, getSecret
  if (r.length === 8) return r[6] === 'versions' && /^[0-9]+$/.test(r[7]); // getSecretVersion
  return false;
}

const ENVELOPE_FIELDS = ['serverPublicKey', 'nonce', 'tag', 'ciphertext'] as const;

/**
 * Opens the 2xx body of an envelope-required read that was sent with `keyPair`'s public key, returning the
 * server's plaintext JSON. Throws {@link E2EEResponseError}, never returns the body as-is.
 */
export async function openRequiredEnvelope(
  keyPair: E2EKeyPair,
  path: string,
  bodyText: string,
): Promise<unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(bodyText);
  } catch {
    throw new E2EEResponseError(E2EE_PLAINTEXT_RESPONSE, path);
  }
  if (
    typeof raw !== 'object' || raw === null || Array.isArray(raw) ||
    (raw as Record<string, unknown>).encrypted !== true
  ) {
    throw new E2EEResponseError(E2EE_PLAINTEXT_RESPONSE, path);
  }

  const envelope = raw as Record<string, unknown>;
  const missing = ENVELOPE_FIELDS.find((f) => typeof envelope[f] !== 'string' || envelope[f] === '');
  if (missing) {
    throw new E2EEResponseError(E2EE_DECRYPTION_FAILED, path, new Error(`envelope field '${missing}' missing`));
  }
  try {
    return await keyPair.decryptRaw(envelope as unknown as E2EEncryptedPayload);
  } catch (err) {
    throw new E2EEResponseError(E2EE_DECRYPTION_FAILED, path, err);
  }
}
