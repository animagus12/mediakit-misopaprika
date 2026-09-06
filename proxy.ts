import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from "@/lib/visitor";

// The public pages that count unique visitors. Both share one cookie: it
// identifies a person, not a page, so someone who sees the media kit and then
// the links page is one visitor to each rather than two anonymous ids.
const VISITOR_TRACKED_PATHS = new Set(["/mediakit", "/links"]);

// Public: just tags first-time visitors with an anonymous id so each editor
// screen can show a unique-visitor count alongside total views.
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
  if (VISITOR_TRACKED_PATHS.has(request.nextUrl.pathname)) {
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
    "/links",
    "/links-editor/:path*",
    "/workspace/:path*",
    "/brands/:path*",
  ],
};
