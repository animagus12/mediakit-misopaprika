import { type NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { fetchYouTubeAnalytics } from "@/services/youtube";
import { setCachedYouTubeAnalytics } from "@/lib/cache";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await fetchYouTubeAnalytics();
    await setCachedYouTubeAnalytics(data);
    return NextResponse.json({ ok: true, lastUpdated: data.lastUpdated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
