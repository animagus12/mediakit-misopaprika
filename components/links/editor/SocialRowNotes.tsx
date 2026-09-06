import type { InstagramTokenStatus, SocialStatUpdate, SocialStatsFreshness } from "@/repositories/socialStats";

interface SocialRowNotesProps {
  /** The platform typed into the row; anything unrecognised renders nothing. */
  platform: string;
  freshness: SocialStatsFreshness;
  instagramToken: InstagramTokenStatus;
}

// Fixed locale and UTC so the server render and the client hydration produce
// the same string — a viewer's timezone would otherwise change the date and
// trip a hydration mismatch. (The relative part is computed server-side, for
// the same reason; see SocialStatUpdate.)
const STAMP = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

// globals.css has no warning/success token, so meaning-carrying colour follows
// the destructive variant's shape: a raw palette hue at low opacity.
const OVERDUE =
  "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
const EXPIRED = "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/15";

const NOTE = "mt-1 ml-11 text-[11px]";
const MUTED = `text-muted-foreground ${NOTE}`;
const ALERT = `${NOTE} rounded-md border px-2 py-1`;

// Only the platforms whose figures the daily jobs actually cache. The others
// are ordinary links with nothing to report.
const FIGURES: Record<string, { key: keyof SocialStatsFreshness; noun: string }> = {
  instagram: { key: "instagram", noun: "Follower count" },
  youtube: { key: "youtube", noun: "Subscriber count" },
};

function ago(hours: number): string {
  if (hours < 1) return "less than an hour ago";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function LastUpdated({ noun, update }: { noun: string; update: SocialStatUpdate | null }) {
  // The cached figure carries a 26h TTL, so a stalled job makes the entry
  // vanish rather than go stale — absence is the symptom to name, not age.
  if (!update) {
    return (
      <p className={MUTED}>{noun} not cached — the daily refresh hasn&apos;t run, or it failed.</p>
    );
  }
  return (
    <p className={MUTED}>
      {noun} updated {ago(update.hoursAgo)} · {STAMP.format(new Date(update.at))} UTC
    </p>
  );
}

/**
 * The small print under a social row: when the figure behind it was last
 * refreshed, and — for Instagram, whose figure rides on a 60-day credential —
 * whether that credential is still renewing itself. Nothing here is
 * actionable while things are working; the states that need a person say so.
 */
export function SocialRowNotes({ platform, freshness, instagramToken }: SocialRowNotesProps) {
  const figure = FIGURES[platform.trim().toLowerCase()];
  if (!figure) return null;

  return (
    <>
      <LastUpdated noun={figure.noun} update={freshness[figure.key]} />
      {figure.key === "instagram" ? <InstagramToken status={instagramToken} /> : null}
    </>
  );
}

function InstagramToken({ status }: { status: InstagramTokenStatus }) {
  // Nothing trustworthy to report (no Redis locally, or an unreadable record).
  // A content editor is the wrong place to raise an infrastructure alarm.
  if (status.state === "unknown") return null;

  if (status.state === "missing") {
    return (
      <p className={MUTED}>
        No access token stored yet — the first daily run seeds it from{" "}
        <code>INSTAGRAM_ACCESS_TOKEN</code>.
      </p>
    );
  }

  const on = STAMP.format(new Date(status.expiresAt));

  if (status.state === "ok") {
    return (
      <p className={MUTED}>
        Access token renews itself — valid to {on} UTC ({status.daysRemaining} days). Nothing to do.
      </p>
    );
  }

  return (
    <p className={`${ALERT} ${status.state === "expired" ? EXPIRED : OVERDUE}`}>
      {status.state === "expired"
        ? `Access token expired on ${on} UTC. Reconnect Instagram and set a fresh INSTAGRAM_ACCESS_TOKEN — the follower count is stale until you do.`
        : `Access token expires ${on} UTC (${status.daysRemaining} days) and the daily job has not renewed it. Check the refresh-instagram cron before it lapses.`}
    </p>
  );
}
