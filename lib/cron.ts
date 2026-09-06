import type { NextRequest } from "next/server";

/**
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` on every cron invocation.
 *
 * Fails closed when CRON_SECRET is unset. Comparing against a template literal
 * built from the env var means an unset secret compares against the literal
 * string "Bearer undefined": which any caller can send, so a single missing
 * environment variable would silently open the endpoint rather than close it.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
