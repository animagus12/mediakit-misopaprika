import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/invoice-auth";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/invoice-generator/login")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isAuthenticated = await verifySessionToken(token);

  if (!isAuthenticated) {
    const loginUrl = new URL("/invoice-generator/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/invoice-generator/:path*", "/mediakit-generator/:path*"],
};
