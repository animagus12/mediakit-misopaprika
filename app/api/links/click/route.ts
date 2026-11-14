import { type NextRequest, NextResponse } from "next/server";
import { incrementLinkClick } from "@/lib/cache";
import { SESSION_COOKIE, isCountableVisit } from "@/lib/visitor";
import { getPublishedLinksData } from "@/repositories/links.writer.server";

// Written to by a beacon fired from the public page as a click navigates away
// (see TrackedLink), so nothing here is on the path of the navigation itself
// and the response body is never read. The status codes are for debugging.
//
// Public by necessity: /links is public, so the proxy doesn't guard this.
// That is why the id is checked against the published page before anything
// is written: incrementLinkClick() creates whatever hash field it is handed,
// and an unvalidated id would let anyone grow that key without bound.

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  const itemId =
    typeof body === "object" && body !== null ? (body as { itemId?: unknown }).itemId : undefined;
  if (typeof itemId !== "string" || itemId.length === 0) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  const data = await getPublishedLinksData();
  const exists = data.sections.some((section) =>
    section.items.some((item) => item.id === itemId)
  );
  if (!exists) {
    return NextResponse.json({ error: "Unknown link" }, { status: 404 });
  }

  // Same rule as the page views beside these clicks: the owner trying their
  // own links, and bots, don't count, or the click rate measures the wrong
  // people on one side of the division.
  const countable = await isCountableVisit(
    request.cookies.get(SESSION_COOKIE)?.value,
    request.headers.get("user-agent")
  );
  if (!countable) return NextResponse.json({ ok: true, counted: false });

  await incrementLinkClick(itemId);
  return NextResponse.json({ ok: true, counted: true });
}
