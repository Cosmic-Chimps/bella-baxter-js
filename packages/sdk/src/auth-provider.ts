/**
 * BellaAuthProvider — Kiota AuthenticationProvider for Bella Baxter API key auth.
 *
 * Computes HMAC-SHA256 signing headers per request (X-Bella-Key-Id,
 * X-Bella-Timestamp, X-Bella-Signature). The raw bax- token is never sent
 * over the wire; only the keyId and the per-request signature are transmitted.
 *
 * Uses the Web Crypto API (globalThis.crypto.subtle) — works in Node.js 18+,
 * Vercel Edge, Cloudflare Workers, and browsers. No Node.js 'crypto' import.
 */

import type {
  AuthenticationProvider,
  RequestInformation,
} from '@microsoft/kiota-abstractions';
import { HttpMethod } from '@microsoft/kiota-abstractions';
import { hexToBytes, sha256Hex, hmacSha256Hex } from './webcrypto.js';

export interface BellaAuthOptions {
  /** API key (bax-...) for HMAC-signed auth. Mutually exclusive with accessToken. */
  apiKey?: string;
  /**
   * JWT access token for Bearer auth (injected by `bella exec` in JWT mode).
   * Mutually exclusive with apiKey.
   */
  accessToken?: string;
  /**
   * Optional name of your application, sent as X-App-Client header for audit logging.
   * Defaults to BELLA_BAXTER_APP_CLIENT env var if set, otherwise not sent.
   * Example: "my-express-api", "github-ci-deploy"
   */
  appClient?: string;
}

function parseBaxToken(apiKey: string): {
  keyId: string;
  signingSecretHex: string;
} {
  if (!apiKey) {
    throw new Error(
      'Bella API key is missing.\n' +
      '  Set BELLA_BAXTER_API_KEY in your environment or pass apiKey to the SDK options.\n' +
      '  You can generate an API key in the Bella Baxter WebApp under Settings → API Keys.',
    );
  }
  const parts = apiKey.split('-');
  if (parts.length !== 3 || parts[0] !== 'bax') {
    throw new Error(
      `Invalid Bella API key format (expected "bax-<id>-<secret>", got "${apiKey.slice(0, 12)}…").\n` +
      '  Generate a valid API key in the Bella Baxter WebApp under Settings → API Keys.',
    );
  }
  return { keyId: parts[1], signingSecretHex: parts[2] };
}

function methodName(method?: HttpMethod): string {
  if (!method) return 'GET';
  // HttpMethod is a string enum: 'GET', 'POST', 'PUT', 'DELETE', etc.
  return String(method).toUpperCase();
}

export class BellaAuthenticationProvider implements AuthenticationProvider {
  private readonly keyId: string | null;
  private readonly signingSecret: Uint8Array | null;
  private readonly accessToken: string | null;
  private readonly appClient: string | undefined;

  constructor(options: BellaAuthOptions) {
    if (options.accessToken) {
      // Bearer token mode (JWT injected by bella exec)
      this.accessToken = options.accessToken;
      this.keyId = null;
      this.signingSecret = null;
    } else if (options.apiKey) {
      // HMAC-signed API key mode
      const { keyId, signingSecretHex } = parseBaxToken(options.apiKey);
      this.keyId = keyId;
      this.signingSecret = hexToBytes(signingSecretHex);
      this.accessToken = null;
    } else {
      throw new Error(
        'Bella authentication is missing.\n' +
        '  Set BELLA_BAXTER_API_KEY or BELLA_BAXTER_ACCESS_TOKEN in your environment,\n' +
        '  or pass apiKey / accessToken to the SDK options.',
      );
    }
    this.appClient = options.appClient ?? (typeof process !== 'undefined' ? process.env['BELLA_BAXTER_APP_CLIENT'] : undefined);
  }

  async authenticateRequest(
    request: RequestInformation,
    _additionalAuthenticationContext?: Record<string, unknown>,
  ): Promise<void> {
    if (this.accessToken) {
      // Bearer token mode — simple Authorization header, no signing
      request.headers.tryAdd('Authorization', `Bearer ${this.accessToken}`);
      request.headers.tryAdd('X-Bella-Client', 'bella-js-sdk');
      if (this.appClient) request.headers.tryAdd('X-App-Client', this.appClient);
      return;
    }

    // HMAC-signed API key mode
    const method = methodName(request.httpMethod);

    // Extract path + sorted query from request.URL
    let path = '/';
    let query = '';
    try {
      const parsed = new URL(request.URL ?? '');
      path = parsed.pathname;
      const params = [...parsed.searchParams.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      query = params;
    } catch {
      // URL may be a relative path — use as-is
      const qIdx = (request.URL ?? '').indexOf('?');
      if (qIdx >= 0) {
        path = (request.URL ?? '').slice(0, qIdx);
        query = (request.URL ?? '').slice(qIdx + 1);
      } else {
        path = request.URL ?? '/';
      }
    }

    // Body hash — request.content is ArrayBuffer | Uint8Array | undefined
    let bodyBytes: Uint8Array = new Uint8Array(0);
    if (request.content) {
      bodyBytes =
        request.content instanceof ArrayBuffer
          ? new Uint8Array(request.content)
          : (request.content as Uint8Array);
    }

    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const bodyHash = await sha256Hex(bodyBytes);
    const stringToSign = `${method}\n${path}\n${query}\n${timestamp}\n${bodyHash}`;
    const signature = await hmacSha256Hex(this.signingSecret!, stringToSign);

    request.headers.tryAdd('X-Bella-Key-Id', this.keyId!);
    request.headers.tryAdd('X-Bella-Timestamp', timestamp);
    request.headers.tryAdd('X-Bella-Signature', signature);
    request.headers.tryAdd('X-Bella-Client', 'bella-js-sdk');
    if (this.appClient) request.headers.tryAdd('X-App-Client', this.appClient);
  }
}

// Keep old name as alias for backward-compat with existing SDK consumers
/** @deprecated Use BellaAuthenticationProvider instead */
export class BellaAccessTokenProvider {
  constructor(_options: BellaAuthOptions) {
    throw new Error(
      'BellaAccessTokenProvider is no longer supported. Use BellaAuthenticationProvider.',
    );
  }
}
