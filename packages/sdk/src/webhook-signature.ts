/**
 * Verifies the X-Bella-Signature header on incoming Bella Baxter webhook requests.
 *
 * Signature format:  X-Bella-Signature: t={unix_epoch_seconds},v1={hmac_sha256_hex}
 * Signing input:     "{t}.{rawBodyJson}"  (UTF-8)
 * HMAC key:          the raw signing secret string (full whsec-xxx value, UTF-8 encoded)
 *
 * Uses the Web Crypto API (globalThis.crypto.subtle) — works in Node.js 18+,
 * Vercel Edge, Cloudflare Workers, and browsers. No Node.js 'crypto' import.
 */

const enc = new TextEncoder();

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both inputs must be the same length for the comparison to be meaningful;
 * a length mismatch returns false immediately (safe when one side is always
 * a fixed-length HMAC hex digest).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies the `X-Bella-Signature` header on an incoming Bella Baxter webhook request.
 *
 * @param secret           The whsec-xxx signing secret (raw string, not hex-decoded).
 * @param signatureHeader  Value of the X-Bella-Signature header.
 * @param rawBody          Raw request body (string or bytes).
 * @param toleranceSeconds Maximum age of the timestamp in seconds (default 300).
 * @returns                `true` if the signature is valid and the timestamp is within tolerance.
 * @throws                 `Error` if the header is malformed or the timestamp is out of tolerance.
 */
export async function verifyWebhookSignature(
  secret: string,
  signatureHeader: string,
  rawBody: string | Uint8Array,
  toleranceSeconds = 300,
): Promise<boolean> {
  // Parse t= and v1= from signatureHeader ("t=...,v1=...")
  let timestamp: number | undefined;
  let v1: string | undefined;

  for (const part of signatureHeader.split(',')) {
    const trimmed = part.trim();
    if (trimmed.startsWith('t=')) {
      const parsed = Number(trimmed.slice(2));
      if (!Number.isInteger(parsed)) {
        throw new Error('Malformed X-Bella-Signature header: t= is not a valid integer');
      }
      timestamp = parsed;
    } else if (trimmed.startsWith('v1=')) {
      v1 = trimmed.slice(3);
    }
  }

  if (timestamp === undefined || v1 === undefined) {
    throw new Error('Malformed X-Bella-Signature header: missing t= or v1=');
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > toleranceSeconds) {
    throw new Error(
      `Webhook timestamp is stale or in the future (age=${age}s, tolerance=${toleranceSeconds}s)`,
    );
  }

  // Build signing input: "{t}.{rawBody}"
  const bodyStr = typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody);
  const signingInput = `${timestamp}.${bodyStr}`;

  // Import key: the secret is the raw UTF-8 string (not hex-decoded)
  const keyBytes = enc.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const hmacBytes = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(signingInput));
  const expected = bytesToHex(hmacBytes);

  return timingSafeEqual(expected, v1);
}
