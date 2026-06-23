import { type NextRequest, NextResponse } from "next/server";
import { fetchInstagramAnalytics } from "@/services/instagram";
import { setCachedInstagramAnalytics } from "@/lib/cache";

// Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` for cron requests.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await fetchInstagramAnalytics();
    await setCachedInstagramAnalytics(data);
    return NextResponse.json({
      ok: true,
      lastUpdated: data.lastUpdated,
      reels: {
        14: { engagementPct: data.byRange[14].engagementPct, avgViews: data.byRange[14].avgViews },
        30: { engagementPct: data.byRange[30].engagementPct, avgViews: data.byRange[30].avgViews },
        60: { engagementPct: data.byRange[60].engagementPct, avgViews: data.byRange[60].avgViews },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
