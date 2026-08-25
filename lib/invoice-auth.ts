const COOKIE_NAME = "invoice_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getSessionSecret(): string {
  const secret = process.env.INVOICE_SESSION_SECRET;
  if (!secret) {
    throw new Error("INVOICE_SESSION_SECRET environment variable is not set");
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

export async function createSessionToken(): Promise<string> {
  const expiry = Date.now() + SESSION_DURATION_MS;
  const signature = await sign(String(expiry));
  return `${expiry}.${signature}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const [expiryStr, signature] = token.split(".");
  if (!expiryStr || !signature) return false;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  const expected = await sign(expiryStr);
  return timingSafeEqual(expected, signature);
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.INVOICE_PASSWORD;
  if (!expected) return false;
  return timingSafeEqual(password, expected);
}

export { COOKIE_NAME, SESSION_DURATION_MS };
