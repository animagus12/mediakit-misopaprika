import { type NextRequest, NextResponse } from "next/server";
import {
  getInstagramToken,
  setCachedInstagramStats,
  setInstagramToken,
} from "@/lib/cache";
import {
  fetchInstagramStats,
  refreshInstagramTokenIfDue,
  seedTokenRecord,
} from "@/services/instagram";

// Kept separate from refresh-youtube rather than folded into it: this job also
// renews a credential, and a YouTube API outage must not be able to stop that.
// A missed stats refresh costs a stale number; a missed token refresh
// eventually costs a manual OAuth round trip.

// Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` for cron requests.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();

    // Redis is the source of truth once seeded — the env var is only the
    // starting token, and re-seeding from it would overwrite a newer one.
    let record = await getInstagramToken();
    if (!record) {
      const seed = process.env.INSTAGRAM_ACCESS_TOKEN;
      if (!seed) throw new Error("INSTAGRAM_ACCESS_TOKEN must be set for the first run");
      record = seedTokenRecord(seed, now);
      await setInstagramToken(record);
    }

    // Stats first: a refresh that fails shouldn't also cost today's figure.
    const stats = await fetchInstagramStats(record.token);
    await setCachedInstagramStats(stats);

    // Renewal is reported, not thrown — the run still did its main job, and
    // there are ~40 days of headroom to succeed on a later one.
    let refreshed: string | null = null;
    let refreshError: string | null = null;
    try {
      const next = await refreshInstagramTokenIfDue(record, now);
      if (next) {
        await setInstagramToken(next);
        refreshed = next.expiresAt;
      }
    } catch (err) {
      refreshError = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json({
      ok: true,
      lastUpdated: stats.lastUpdated,
      followers: stats.followers,
      tokenExpiresAt: refreshed ?? record.expiresAt,
      tokenRefreshed: refreshed !== null,
      ...(refreshError ? { refreshError } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
