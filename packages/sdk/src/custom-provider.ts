/**
 * Wire contract types for Bella Baxter custom HTTP provider implementations.
 *
 * To verify incoming request signatures, use the existing `verifyWebhookSignature`
 * helper — custom providers use the same signature format as Bella webhooks:
 *   X-Bella-Signature: t={unix-epoch-seconds},v1={hmac-sha256-hex}
 *
 * @example
 * import { verifyWebhookSignature, type BellaProviderRequest } from '@bella-baxter/sdk';
 *
 * app.post('/bella-secrets', express.raw({ type: '*\/*' }), async (req, res) => {
 *   const valid = await verifyWebhookSignature(
 *     process.env.BELLA_SIGNING_SECRET!,
 *     req.headers['x-bella-signature'] as string,
 *     req.body,
 *   );
 *   if (!valid) return res.status(401).json({ error: 'Invalid signature' });
 *   const body = JSON.parse(req.body.toString()) as BellaProviderRequest;
 *   // handle body.action ...
 * });
 */

/** Action values sent by Bella in the request body. */
export type BellaProviderAction = 'list' | 'get' | 'set' | 'delete';

/** Request body sent by Bella to a custom HTTP provider endpoint. */
export interface BellaProviderRequest {
  /** The operation to perform. */
  action: BellaProviderAction;
  /** Namespace/path prefix (e.g. "my-project/dev"). */
  path: string;
  /** Secret key. Undefined for "list" operations. */
  key?: string;
  /** Secret value. Only present for "set" operations. */
  value?: string;
  /** Unique request ID for idempotency tracking. */
  requestId: string;
}

/** Response for a "list" operation. */
export interface BellaProviderListResponse {
  secrets: Record<string, string>;
}

/** Response for a "get" operation. */
export interface BellaProviderGetResponse {
  value: string | null;
}

/** Response for "set" and "delete" operations. */
export interface BellaProviderSuccessResponse {
  success: true;
}

/** Error response — return with non-2xx HTTP status. */
export interface BellaProviderErrorResponse {
  error: string;
}

/**
 * Verifies the `X-Bella-Signature` header on an incoming Bella Baxter custom provider request.
 *
 * Custom providers use the same signature format as webhooks:
 *   X-Bella-Signature: t={unix-epoch-seconds},v1={hmac-sha256-hex}
 *
 * Alias of `verifyWebhookSignature` provided for custom-provider consumers.
 */
export { verifyWebhookSignature as verifyCustomProviderSignature } from './webhook-signature.js';
