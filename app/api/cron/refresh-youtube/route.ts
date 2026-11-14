import { type NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { fetchYouTubeAnalytics, youTubeConfig } from "@/services/youtube";
import { setCachedYouTubeAnalytics } from "@/lib/cache";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Not configured is a state, not a failure, exactly as in
  // refresh-instagram: a daily 500 until the keys are added would train the
  // alert to be ignored.
  const config = youTubeConfig();
  if (!config) {
    return NextResponse.json({ ok: false, skipped: "YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID are not set" });
  }

  try {
    const data = await fetchYouTubeAnalytics(config);
    await setCachedYouTubeAnalytics(data);
    return NextResponse.json({ ok: true, lastUpdated: data.lastUpdated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Vercel records only the cron's status: see refresh-instagram.
    console.error("refresh-youtube failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
