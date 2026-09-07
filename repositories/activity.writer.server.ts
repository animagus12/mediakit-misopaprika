import "server-only";
import { getRedis } from "@/lib/cache";
import { isActivity } from "./activity";
import type { Activity, ActivityEntityType, ActivityPage, NewActivity } from "./activity";

// server-only, and never imported from a client component: the server
// actions, pages and the /api/activity route that need it import it directly.
const ACTIVITY_KEY = "activity";

// The log is the one store that only ever grows, so it is the one store that
// isn't the whole-array read-modify-write every other repository here uses.
// A capped Redis list appends in O(1) and never re-serialises the history to
// add a row, which matters because this write rides along with every other
// write in the app. 500 entries is roughly a year of a solo creator's
// activity and keeps the key comfortably small; the oldest fall off the end.
//
// If unbounded history is ever wanted, that is the point to move this one
// repository to Postgres rather than to raise the cap: nothing outside this
// file knows how the log is stored.
const MAX_ENTRIES = 500;

const EMPTY: ActivityPage = { items: [], total: 0, nextOffset: null };

/**
 * Appends one event to the log.
 *
 * Best-effort by design, exactly like the view counters in lib/cache.ts, and
 * for a sharper reason: the write this event describes has already happened
 * and stands. Losing a log line is strictly better than failing an invoice
 * that saved. That's also why callers need no try/catch of their own, which
 * keeps recording to a single line at the end of an action.
 */
export async function recordActivity(input: NewActivity): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const entry: Activity = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...input,
  };

  try {
    await redis
      .pipeline()
      .lpush(ACTIVITY_KEY, entry)
      .ltrim(ACTIVITY_KEY, 0, MAX_ENTRIES - 1)
      .exec();
  } catch {
    // Non-critical: see above.
  }
}

export interface ListActivitiesOptions {
  offset?: number;
  limit?: number;
  /** Restricts to these entity types; omitted or empty means everything. */
  types?: readonly ActivityEntityType[];
}

/**
 * Newest first, paged.
 *
 * Two read paths, for one reason. Unfiltered, LRANGE can fetch exactly the
 * window asked for, so the dashboard card's six rows cost six rows. Filtered,
 * it can't: a page of the raw list may hold no matching event at all, and
 * paging over it would hand back short pages and skip entries. So a filtered
 * read pulls the log (capped at MAX_ENTRIES, so bounded by construction) and
 * windows it in memory. Only the filtered view on /activity pays for that.
 *
 * Answers an empty page rather than throwing when Redis is unset or
 * unreachable, so a missing log shows an honest empty feed instead of taking
 * the dashboard down with it.
 */
export async function listActivities(options: ListActivitiesOptions = {}): Promise<ActivityPage> {
  const { offset = 0, limit = 50 } = options;
  const types = options.types && options.types.length > 0 ? new Set(options.types) : null;

  const redis = getRedis();
  if (!redis) return EMPTY;

  try {
    if (!types) {
      const [stored, total] = await Promise.all([
        redis.lrange<unknown>(ACTIVITY_KEY, offset, offset + limit - 1),
        redis.llen(ACTIVITY_KEY),
      ]);
      const items = toActivities(stored);
      return { items, total, nextOffset: offset + limit < total ? offset + limit : null };
    }

    const stored = await redis.lrange<unknown>(ACTIVITY_KEY, 0, MAX_ENTRIES - 1);
    const all = toActivities(stored);
    const matching = all.filter((activity) => types.has(activity.entity.type));
    const items = matching.slice(offset, offset + limit);
    return {
      items,
      total: matching.length,
      nextOffset: offset + limit < matching.length ? offset + limit : null,
    };
  } catch {
    return EMPTY;
  }
}

/**
 * The SDK deserialises JSON on the way out, but hands back the raw string
 * when a value doesn't parse, so both shapes are handled here. Anything that
 * still isn't a usable event is dropped: one bad row shouldn't cost the
 * reader the rest of the page (same call made for corrupt click counts in
 * lib/cache.ts's getLinkClicks).
 */
function toActivities(stored: unknown[] | null): Activity[] {
  if (!stored) return [];
  const activities: Activity[] = [];
  for (const value of stored) {
    const parsed = parseEntry(value);
    if (parsed) activities.push(parsed);
  }
  return activities;
}

function parseEntry(value: unknown): Activity | null {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return isActivity(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isActivity(value) ? value : null;
}
