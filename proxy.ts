import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from "@/lib/visitor";

// Public: just tags first-time visitors with an anonymous id so the
// generator screen can show a unique-visitor count alongside total views.
function withVisitorCookie(request: NextRequest) {
  if (request.cookies.get(VISITOR_COOKIE)) {
    return NextResponse.next();
  }

  const visitorId = crypto.randomUUID();
  // Set on the request too so this same render can already read it back.
  request.cookies.set(VISITOR_COOKIE, visitorId);

  const response = NextResponse.next({ request });
  response.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: VISITOR_COOKIE_MAX_AGE,
  });
  return response;
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/mediakit") {
    return withVisitorCookie(request);
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isAuthenticated = await verifySessionToken(token);

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/campaigns/:path*",
    "/invoices/:path*",
    "/mediakit-generator/:path*",
    "/mediakit",
    "/links-editor/:path*",
    "/workspace/:path*",
    "/brands/:path*",
  ],
};
