import { type NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
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

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();

    // Redis is the source of truth once seeded: the env var is only the
    // starting token, and re-seeding from it would overwrite a newer one.
    const stored = await getInstagramToken();
    let record = stored;
    if (!record) {
      const seed = process.env.INSTAGRAM_ACCESS_TOKEN;
      // Not configured yet is a state, not a failure. Throwing here would 500
      // the job every morning until someone finishes the Meta app setup,
      // which trains the alert to be ignored: right up until it fires for a
      // real token expiry months later.
      if (!seed) {
        return NextResponse.json({ ok: false, skipped: "INSTAGRAM_ACCESS_TOKEN is not set" });
      }
      record = seedTokenRecord(seed, now);
    }

    // Stats first: a refresh that fails shouldn't also cost today's figure.
    const stats = await fetchInstagramStats(record.token);
    await setCachedInstagramStats(stats);

    // Only now is a seed token known to work. Persisting it before this call
    // would store a mistyped or expired one, and since the stored key shadows
    // the env var from then on, correcting INSTAGRAM_ACCESS_TOKEN would have
    // no effect until someone deleted the key by hand.
    if (!stored) await setInstagramToken(record);

    // Renewal is reported, not thrown: the run still did its main job, and
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
    // The body reaches whoever called the route by hand; the cron's caller is
    // Vercel, which records only the status. Without this the daily failure is
    // a bare 500 with no way to tell a bad token from an API outage.
    console.error("refresh-instagram failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
