/**
 * Wire contract types for Bella Baxter secret rotation function implementations.
 *
 * Bella calls your rotation function with HMAC-signed requests for two actions:
 *   - "rotate"  → generate/provision a new secret value, return it
 *   - "revoke"  → revoke the old secret value (called after sunset period)
 *
 * The signing format is identical to Bella webhooks and custom providers:
 *   X-Bella-Signature: t={unix-epoch-seconds},v1={hmac-sha256-hex}
 *
 * Use `verifyWebhookSignature` from this SDK to verify incoming requests.
 *
 * @example
 * import { verifyWebhookSignature, type BellaRotateRequest } from '@bella-baxter/sdk';
 *
 * app.post('/rotate', express.raw({ type: '*\/*' }), async (req, res) => {
 *   const valid = await verifyWebhookSignature(
 *     process.env.BELLA_SIGNING_SECRET!,
 *     req.headers['x-bella-signature'] as string,
 *     req.body,
 *   );
 *   if (!valid) return res.status(401).json({ error: 'Invalid signature' });
 *
 *   const body = JSON.parse(req.body.toString()) as BellaRotationRequest;
 *
 *   if (body.action === 'rotate') {
 *     const newValue = await provisionNewKey(body.secretKey);
 *     return res.json({ newValue, newHandle: newValue.id } satisfies BellaRotateResponse);
 *   }
 *   if (body.action === 'revoke') {
 *     await revokeOldKey(body.oldHandle);
 *     return res.json({ success: true } satisfies BellaRevokeResponse);
 *   }
 * });
 */

/** Action values sent by Bella in rotation request bodies. */
export type BellaRotationAction = 'rotate' | 'revoke';

/**
 * Base fields sent on all rotation requests.
 * The specific action determines which additional fields are present.
 */
export interface BellaRotationRequestBase {
  /** Unique request ID — use for idempotency. */
  requestId: string;
  /** The secret key name (e.g. "GOOGLE_MAPS_API_KEY"). */
  secretKey: string;
  /** Project slug for context. */
  projectSlug: string;
  /** Environment slug for context. */
  environmentSlug: string;
}

/**
 * Request body for the "rotate" action.
 *
 * Your function should:
 * 1. Provision a new secret value at the external service
 * 2. Return the new value and optionally a resource handle (ID/ARN/name)
 *
 * The handle is stored by Bella and passed back as `oldHandle` in a future revoke call.
 * If you don't return a handle, Bella will skip the revoke call.
 */
export interface BellaRotateRequest extends BellaRotationRequestBase {
  action: 'rotate';
}

/**
 * Request body for the "revoke" action.
 *
 * Bella calls this after the sunset period to revoke the old secret value.
 * `oldHandle` is the value returned as `newHandle` in the previous rotate response.
 */
export interface BellaRevokeRequest extends BellaRotationRequestBase {
  action: 'revoke';
  /** The resource handle returned by the previous rotate response (e.g. API key ID, ARN). */
  oldHandle: string;
}

/** Union of all possible rotation request bodies. */
export type BellaRotationRequest = BellaRotateRequest | BellaRevokeRequest;

/**
 * Response for the "rotate" action.
 *
 * `newValue` is the new secret value that Bella will store.
 * `newHandle` is an optional resource identifier (API key ID, ARN, resource name)
 * that Bella will pass back as `oldHandle` in the revoke request.
 * If omitted, Bella will not call your function for revocation.
 */
export interface BellaRotateResponse {
  /** The new secret value to store in Bella. */
  newValue: string;
  /** Optional resource handle for revocation (e.g. key ID, ARN). */
  newHandle?: string;
}

/**
 * Response for the "revoke" action.
 */
export interface BellaRevokeResponse {
  success: true;
}

/** Error response — return with non-2xx HTTP status. */
export interface BellaRotationErrorResponse {
  error: string;
}
