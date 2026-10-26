import "server-only";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

// The failure half every Server Action already returns, so a client caller
// shows "log in again" through the same toast path as any other error rather
// than a rejected promise it was never written to catch.
export type SessionDenied = { success: false; error: string };

const SESSION_DENIED: SessionDenied = {
  success: false,
  error: "Your session has expired. Log in again.",
};

/**
 * The login check for Server Actions. proxy.ts only guards page paths: a
 * Server Action is a separate POST endpoint that can be called directly, so a
 * page being behind login does not put its actions behind login. Every
 * exported action calls this first:
 *
 *   const denied = await requireSession();
 *   if (denied) return denied;
 *
 * Returns null when the request carries a valid session cookie.
 */
export async function requireSession(): Promise<SessionDenied | null> {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    return (await verifySessionToken(token)) ? null : SESSION_DENIED;
  } catch (error) {
    // A missing SESSION_SECRET throws inside verifySessionToken. Refusing is
    // the only safe answer: there is no way to tell a real session apart.
    console.error("Session check failed", error);
    return SESSION_DENIED;
  }
}
