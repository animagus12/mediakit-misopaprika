// Instagram API with Instagram Login (graph.instagram.com). Unlike YouTube,
// which authenticates with a plain API key, this needs a user access token
// that expires — so the token itself is state the app has to keep and renew.
// See refreshInstagramTokenIfDue() for why that lives here.

// Pinned rather than left unversioned: an unversioned graph.instagram.com call
// resolves to the OLDEST version Meta still serves, which is the one most
// likely to be dropped. Bump deliberately.
const GRAPH_VERSION = "v23.0";

// Long-lived tokens last 60 days. Renewing once there is less than this left
// means a refresh normally happens ~20 days after the last one, so the cron
// can fail silently for six weeks before anything actually breaks.
const REFRESH_WHEN_REMAINING_MS = 40 * 24 * 60 * 60 * 1000;

// Meta rejects a refresh of a token younger than this.
const MIN_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

export interface InstagramStatsCache {
  lastUpdated: string;
  followers: number;
  username: string;
}

/**
 * The live token and when it lapses. Persisted (not held in an env var)
 * because a refresh mints a *new* token — the process cannot rewrite its own
 * environment, so a token kept only in `INSTAGRAM_ACCESS_TOKEN` would be
 * frozen at whatever was deployed and die 60 days later.
 */
export interface InstagramTokenRecord {
  token: string;
  /** ISO timestamp. */
  expiresAt: string;
  /** ISO timestamp of the last successful refresh, or of seeding from env. */
  refreshedAt: string;
}

interface GraphError {
  error?: { message?: string; type?: string; code?: number };
}

async function graphJson<T>(url: string, what: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json()) as T & GraphError;
  if (!res.ok || body.error) {
    // Meta puts the useful part in the body, not the status line.
    throw new Error(`Instagram ${what} failed (${res.status}): ${body.error?.message ?? "unknown error"}`);
  }
  return body;
}

/** Seeds a token record from the env var, for the very first run. */
export function seedTokenRecord(token: string, now: number): InstagramTokenRecord {
  return {
    token,
    // The env token's real expiry isn't knowable from the token itself. Assume
    // the full 60 days; the first refresh replaces this with the true value.
    expiresAt: new Date(now + SIXTY_DAYS_MS).toISOString(),
    refreshedAt: new Date(now).toISOString(),
  };
}

export async function fetchInstagramStats(token: string): Promise<InstagramStatsCache> {
  const body = await graphJson<{ followers_count?: number; username?: string }>(
    `https://graph.instagram.com/${GRAPH_VERSION}/me?fields=followers_count,username&access_token=${encodeURIComponent(token)}`,
    "me"
  );

  if (typeof body.followers_count !== "number") {
    // The field is only returned for Business and Creator accounts.
    throw new Error(
      "Instagram returned no followers_count — the account must be a Business or Creator account"
    );
  }

  return {
    lastUpdated: new Date().toISOString(),
    followers: body.followers_count,
    username: body.username ?? "",
  };
}

/**
 * Renews the token when it is close enough to lapsing, and returns the new
 * record — or null when nothing was due, which is the common case.
 *
 * `now` is a parameter rather than a clock read so the due/not-due decision is
 * testable, the same reason visibleSections() takes one.
 */
export async function refreshInstagramTokenIfDue(
  record: InstagramTokenRecord,
  now: number
): Promise<InstagramTokenRecord | null> {
  const remaining = Date.parse(record.expiresAt) - now;
  const age = now - Date.parse(record.refreshedAt);

  if (Number.isNaN(remaining) || remaining > REFRESH_WHEN_REMAINING_MS) return null;
  // A token Meta considers too young is refused; wait for the next run rather
  // than burning the attempt and logging a failure.
  if (Number.isNaN(age) || age < MIN_TOKEN_AGE_MS) return null;

  const body = await graphJson<{ access_token?: string; expires_in?: number }>(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(record.token)}`,
    "refresh_access_token"
  );

  if (!body.access_token || typeof body.expires_in !== "number") {
    throw new Error("Instagram refresh_access_token returned no token");
  }

  return {
    token: body.access_token,
    expiresAt: new Date(now + body.expires_in * 1000).toISOString(),
    refreshedAt: new Date(now).toISOString(),
  };
}
