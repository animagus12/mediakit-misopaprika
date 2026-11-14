import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  DEFAULT_SESSION_DURATION_MS,
  REMEMBER_ME_DURATION_MS,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { loginRateLimiter } from "@/lib/loginRateLimit.server";

// Vercel sets x-forwarded-for itself, overwriting whatever the client sent.
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limiter = loginRateLimiter();
  if (!(await limiter.allow(ip))) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const rememberMe = body?.rememberMe === true;

  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  await limiter.reset(ip);

  const durationMs = rememberMe ? REMEMBER_ME_DURATION_MS : DEFAULT_SESSION_DURATION_MS;
  const token = await createSessionToken(durationMs);
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: durationMs / 1000,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
