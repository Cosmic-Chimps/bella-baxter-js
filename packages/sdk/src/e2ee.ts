/**
 * e2ee.ts — ECDH-P256-HKDF-SHA256-AES256GCM client-side decryption.
 *
 * Uses the Web Crypto API (SubtleCrypto) available in:
 *   - Node.js 18+  (`globalThis.crypto.subtle`)
 *   - Browsers (all modern)
 *   - Deno, Bun, Cloudflare Workers
 *
 * No external dependencies.
 */

/** Wire format of the encrypted payload returned by the Bella Baxter API. */
export interface E2EEncryptedPayload {
  encrypted: true;
  algorithm: string;
  serverPublicKey: string; // base64-encoded SPKI
  nonce: string;           // base64-encoded 12 bytes
  tag: string;             // base64-encoded 16 bytes
  ciphertext: string;      // base64-encoded
}

/** Returns the SubtleCrypto implementation, throwing if unavailable. */
function getSubtle(): SubtleCrypto {
  const subtle =
    (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) ??
    // Node.js < 19 without --experimental-global-webcrypto
    (typeof require !== 'undefined'
      ? (() => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            return require('crypto').webcrypto?.subtle;
          } catch {
            return undefined;
          }
        })()
      : undefined);

  if (!subtle) {
    throw new Error(
      'Web Crypto API (SubtleCrypto) is not available. ' +
        'Use Node.js 18+ or a modern browser.',
    );
  }
  return subtle as SubtleCrypto;
}

// ── Base64 helpers ─────────────────────────────────────────────────────────────

function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64Encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

// ── E2E Key Pair ───────────────────────────────────────────────────────────────

/** P-256 key pair used for one-time E2EE handshake with the Bella Baxter API. */
export class E2EKeyPair {
  private constructor(
    private readonly privateKey: CryptoKey,
    /** Base64-encoded SPKI public key — value for the ``X-E2E-Public-Key`` header. */
    public readonly publicKeyB64: string,
  ) {}

  /** Generate a fresh P-256 key pair (async, uses Web Crypto). */
  static async generate(): Promise<E2EKeyPair> {
    const subtle = getSubtle();
    const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveKey',
      'deriveBits',
    ]);
    const spki = await subtle.exportKey('spki', kp.publicKey);
    return new E2EKeyPair(kp.privateKey, b64Encode(spki));
  }

  /**
   * Decrypt an encrypted secrets payload from the Bella Baxter API.
   *
   * @returns Decrypted ``{ key: value }`` secrets map.
   */
  async decrypt(payload: E2EEncryptedPayload): Promise<Record<string, string>> {
    const subtle = getSubtle();

    const serverPubBytes = b64Decode(payload.serverPublicKey);
    const nonce          = b64Decode(payload.nonce);
    const tag            = b64Decode(payload.tag);
    const ciphertext     = b64Decode(payload.ciphertext);

    // 1. Import server ephemeral public key (SPKI)
    const serverPub = await subtle.importKey(
      'spki',
      serverPubBytes.buffer as ArrayBuffer,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );

    // 2. ECDH → raw 32-byte shared secret
    const rawSecret = await subtle.deriveBits(
      { name: 'ECDH', public: serverPub },
      this.privateKey,
      256,
    );

    // 3. HKDF-SHA256 → 32-byte AES key  (salt = 32 zeros per RFC 5869 §2.2)
    const hkdfKeyMaterial = await subtle.importKey('raw', rawSecret, 'HKDF', false, [
      'deriveBits',
    ]);
    const info = new TextEncoder().encode('bella-e2ee-v1');
    const salt = new Uint8Array(32); // 32 zeros (SHA-256 hash length)
    const aesKeyBits = await subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info },
      hkdfKeyMaterial,
      256,
    );
    const aesKey = await subtle.importKey('raw', aesKeyBits, 'AES-GCM', false, ['decrypt']);

    // 4. AES-256-GCM decrypt — combine ciphertext + tag (SubtleCrypto expects them joined)
    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext, 0);
    combined.set(tag, ciphertext.length);

    const plaintext = await subtle.decrypt({ name: 'AES-GCM', iv: nonce as unknown as BufferSource, tagLength: 128 }, aesKey, combined.buffer as ArrayBuffer);

    const parsed = JSON.parse(new TextDecoder().decode(plaintext));

    // Server returns List<SecretItem> (array of {key, value, ...} objects) for
    // provider-specific endpoints. Convert to flat Record<string, string>.
    if (Array.isArray(parsed)) {
      const result: Record<string, string> = {};
      for (const item of parsed) {
        if (typeof item?.key === 'string') result[item.key] = item.value ?? '';
      }
      return result;
    }

    // Full AllEnvironmentSecretsResponse — extract the nested secrets dict.
    if (
      typeof parsed === 'object' && parsed !== null &&
      'secrets' in parsed && typeof (parsed as Record<string, unknown>).secrets === 'object' &&
      !Array.isArray((parsed as Record<string, unknown>).secrets)
    ) {
      return (parsed as Record<string, unknown>).secrets as Record<string, string>;
    }

    // Legacy / single-secret: already a flat key→value object.
    return parsed as Record<string, string>;
  }

  /**
   * Decrypt and return the raw parsed JSON without any transformation.
   * Use this when the caller needs the full server response (e.g. version,
   * environmentSlug, lastModified) rather than just the secrets dict.
   */
  async decryptRaw(payload: E2EEncryptedPayload): Promise<unknown> {
    const subtle = getSubtle();

    const serverPubBytes = b64Decode(payload.serverPublicKey);
    const nonce          = b64Decode(payload.nonce);
    const tag            = b64Decode(payload.tag);
    const ciphertext     = b64Decode(payload.ciphertext);

    const serverPub = await subtle.importKey(
      'spki', serverPubBytes.buffer as ArrayBuffer,
      { name: 'ECDH', namedCurve: 'P-256' }, false, [],
    );
    const rawSecret = await subtle.deriveBits(
      { name: 'ECDH', public: serverPub }, this.privateKey, 256,
    );
    const hkdfKeyMaterial = await subtle.importKey('raw', rawSecret, 'HKDF', false, ['deriveBits']);
    const info = new TextEncoder().encode('bella-e2ee-v1');
    const salt = new Uint8Array(32);
    const aesKeyBits = await subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info }, hkdfKeyMaterial, 256,
    );
    const aesKey = await subtle.importKey('raw', aesKeyBits, 'AES-GCM', false, ['decrypt']);

    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext, 0);
    combined.set(tag, ciphertext.length);

    const plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv: nonce as unknown as BufferSource, tagLength: 128 },
      aesKey, combined.buffer as ArrayBuffer,
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  }
}

// ── Helper ─────────────────────────────────────────────────────────────────────

/** Returns ``true`` if the raw response JSON looks like an encrypted payload. */
export function isE2EPayload(raw: unknown): raw is E2EEncryptedPayload {
  return typeof raw === 'object' && raw !== null && (raw as E2EEncryptedPayload).encrypted === true;
}
