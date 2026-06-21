import { type NextRequest, NextResponse } from "next/server";
import { fetchYouTubeAnalytics } from "@/services/youtube";
import { setCachedYouTubeAnalytics } from "@/lib/cache";

// Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` for cron requests.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
