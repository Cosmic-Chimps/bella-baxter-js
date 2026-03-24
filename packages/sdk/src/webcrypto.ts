/**
 * Portable crypto helpers — uses the Web Crypto API (globalThis.crypto.subtle)
 * which is available in Node.js 18+, Vercel Edge, Cloudflare Workers, and browsers.
 * No Node.js 'crypto' module is imported, so this file is safe for Edge runtimes.
 */

const enc = new TextEncoder();

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function toBytes(data: string | Uint8Array): Uint8Array {
  return typeof data === 'string' ? enc.encode(data) : data;
}

/** SHA-256 digest → lowercase hex string. */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = toBytes(data) as Uint8Array<ArrayBuffer>;
  return bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
}

/**
 * HMAC-SHA256 signature → lowercase hex string.
 * @param keyBytes  Raw key bytes (e.g. decoded from hex API key secret).
 * @param data      Message to sign.
 */
export async function hmacSha256Hex(keyBytes: Uint8Array, data: string | Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const msgBytes = toBytes(data) as Uint8Array<ArrayBuffer>;
  return bytesToHex(await crypto.subtle.sign('HMAC', key, msgBytes));
}
