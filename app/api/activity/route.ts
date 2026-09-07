import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { resolveActivityFilter } from "@/lib/activity";
import { listActivities } from "@/repositories/activity.writer.server";

// Read-only JSON view of the activity log, for anything outside the app that
// wants it (a script, a widget, a future mobile client).
//
// It checks the session itself rather than relying on the proxy: proxy.ts's
// matcher lists pages only, so nothing under /api is guarded by it. That is
// fine for the routes already there (the cron jobs carry a bearer token, the
// click beacon is public by necessity because /links is), but this hands back
// brand names, campaign names and invoice numbers, so it has to gate itself.

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

function positiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: NextRequest) {
  const authenticated = await verifySessionToken(request.cookies.get(COOKIE_NAME)?.value);
  if (!authenticated) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  // Same filter vocabulary the /activity tabs use ("brands", "invoices", ...),
  // so a link to the page and a call to this route mean the same thing by the
  // same name. An unknown value reads as "all" rather than erroring.
  const filter = resolveActivityFilter(params.get("type") ?? undefined);

  const page = await listActivities({
    offset: positiveInt(params.get("offset"), 0, Number.MAX_SAFE_INTEGER),
    limit: positiveInt(params.get("limit"), DEFAULT_LIMIT, MAX_LIMIT) || DEFAULT_LIMIT,
    types: filter.types,
  });

  return NextResponse.json({ ...page, type: filter.id });
}
