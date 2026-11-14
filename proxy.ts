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

// Pages anyone may open without signing in, beside the two above. Every
// other page needs a session, so a page added later is private until it is
// listed here, rather than public until someone remembers to guard it.
const PUBLIC_PATHS = new Set(["/login"]);

// The share images crawlers fetch for /links and /mediakit previews.
const PUBLIC_PREFIXES = ["/links/opengraph-image", "/mediakit/opengraph-image"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (VISITOR_TRACKED_PATHS.has(pathname)) {
    return withVisitorCookie(request);
  }
  if (isPublicPath(pathname)) {
    return NextResponse.next();
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

// Every path except:
//   api/       each route checks the session itself (cron jobs carry a bearer
//              token, the click beacon is public), see app/api
//   _next/     the framework's own scripts, styles and images
//   _vercel/   Vercel Analytics and Speed Insights
//   __nextjs   the dev server's error overlay
//   files      anything ending in an extension: public/ (the invoice and
//              media kit artwork the PDF renderer loads too), icon.png,
//              robots.txt. No page path has a dot in it.
export const config = {
  matcher: ["/((?!api/|_next/|_vercel/|__nextjs|.*\\.[^/]+$).*)"],
};
