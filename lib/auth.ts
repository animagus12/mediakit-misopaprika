const COOKIE_NAME = "app_session";
const DEFAULT_SESSION_DURATION_MS = 1000 * 60 * 60 * 4; // 4 hours
const REMEMBER_ME_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return secret;
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

let cachedKeyPromise: Promise<CryptoKey> | null = null;

function getSigningKey(): Promise<CryptoKey> {
  if (!cachedKeyPromise) {
    cachedKeyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(getSessionSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
  }
  return cachedKeyPromise;
}

async function sign(data: string): Promise<string> {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(signature);
}

/**
 * What a session's signature covers: its expiry and the current password.
 *
 * Folding the password in means changing APP_PASSWORD signs out every
 * session at once, a stolen 30-day cookie included. Before, the only way to
 * do that was rotating SESSION_SECRET, which also locks every online backup
 * (they are encrypted with a key derived from it). Null when no password is
 * set: no session can be valid then, as no one can sign in.
 */
function sessionPayload(expiry: string): string | null {
  const password = process.env.APP_PASSWORD;
  return password ? `session.${expiry}.${password}` : null;
}

export async function createSessionToken(durationMs: number = DEFAULT_SESSION_DURATION_MS): Promise<string> {
  const expiry = String(Date.now() + durationMs);
  const payload = sessionPayload(expiry);
  if (!payload) throw new Error("APP_PASSWORD environment variable is not set");
  return `${expiry}.${await sign(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const [expiryStr, signature] = token.split(".");
  if (!expiryStr || !signature) return false;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  const payload = sessionPayload(expiryStr);
  if (!payload) return false;
  return timingSafeEqual(await sign(payload), signature);
}

/**
 * Compares signatures of the two rather than the strings themselves:
 * signatures are always the same length, so the time taken says nothing
 * about the password's length, which a direct comparison gave away.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  const [given, wanted] = await Promise.all([sign(`password.${password}`), sign(`password.${expected}`)]);
  return timingSafeEqual(given, wanted);
}

export { COOKIE_NAME, DEFAULT_SESSION_DURATION_MS, REMEMBER_ME_DURATION_MS };
