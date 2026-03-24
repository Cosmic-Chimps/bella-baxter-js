/**
 * @bella-baxter/express
 *
 * Express middleware — injects bella secrets onto req.bella.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { createBellaMiddleware } from '@bella-baxter/express';
 *
 * const app = express();
 *
 * app.use(await createBellaMiddleware({
 *   baxterUrl: process.env.BELLA_BAXTER_URL!,
 *   environmentSlug: 'production',
 *   apiKey: process.env.BELLA_BAXTER_API_KEY!,
 *   
 * }));
 *
 * app.get('/health', (req, res) => {
 *   const dbUrl = req.bella.get('DATABASE_URL');
 *   res.json({ ok: true });
 * });
 * ```
 *
 * TypeScript: extend express Request to add req.bella:
 * ```ts
 * declare global {
 *   namespace Express {
 *     interface Request { bella: BellaConfig }
 *   }
 * }
 * ```
 */

import type { Request, Response, NextFunction } from 'express';
import { BellaConfig, createBellaConfig, type BellaConfigOptions } from '@bella-baxter/sdk';

export { BellaConfig, type BellaConfigOptions };

/**
 * Creates an Express middleware that attaches a `BellaConfig` instance to `req.bella`.
 * The config is loaded once and shared across all requests (polling runs in background).
 */
export async function createBellaMiddleware(
  options: BellaConfigOptions,
): Promise<(req: Request, res: Response, next: NextFunction) => void> {
  const bella = await createBellaConfig(options);

  return (req: Request & { bella?: BellaConfig }, _res: Response, next: NextFunction) => {
    req.bella = bella;
    next();
  };
}
