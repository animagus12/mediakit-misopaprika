import "server-only";
import type { Redis } from "@upstash/redis";
import { getRedis } from "@/lib/cache";

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;
const KEY_PREFIX = "login_attempts:";

/** Where sign-in attempts are counted, per client address. */
export interface AttemptStore {
  /** Counts one attempt and answers how many the key has made in the window. */
  hit(key: string): Promise<number>;
  clear(key: string): Promise<void>;
}

/**
 * The count for one server instance only. Vercel runs several and recycles
 * them, so on its own this limits very little; it is the fallback for when
 * the store is unset (local dev without KV) or unreachable. Expired entries
 * are dropped on every hit, so the map holds only addresses inside a window.
 */
export function memoryAttemptStore(windowMs: number, now: () => number = Date.now): AttemptStore {
  const entries = new Map<string, { count: number; resetAt: number }>();
  return {
    async hit(key) {
      const at = now();
      for (const [entryKey, entry] of entries) {
        if (entry.resetAt <= at) entries.delete(entryKey);
      }
      const entry = entries.get(key);
      if (!entry) {
        entries.set(key, { count: 1, resetAt: at + windowMs });
        return 1;
      }
      entry.count += 1;
      return entry.count;
    },
    async clear(key) {
      entries.delete(key);
    },
  };
}

/**
 * The count every instance shares. INCR and EXPIRE go in one MULTI: were the
 * EXPIRE ever lost, the key would never lapse and the address would stay
 * locked out for good. NX keeps the window fixed from the first attempt, so
 * retrying during a lockout does not extend it.
 */
function redisAttemptStore(redis: Redis, windowSeconds: number): AttemptStore {
  return {
    async hit(key) {
      const [count] = await redis
        .multi()
        .incr(`${KEY_PREFIX}${key}`)
        .expire(`${KEY_PREFIX}${key}`, windowSeconds, "NX")
        .exec<[number, 0 | 1]>();
      return count;
    },
    async clear(key) {
      await redis.del(`${KEY_PREFIX}${key}`);
    },
  };
}

export interface LoginRateLimiter {
  /** Counts the attempt; false once the address has made more than allowed in the window. */
  allow(key: string): Promise<boolean>;
  /** Forgets the address's attempts, after a correct password. */
  reset(key: string): Promise<void>;
}

/**
 * Every attempt is counted before the password is checked, so a correct one
 * made during a lockout is refused like any other: otherwise a guesser could
 * keep going and simply watch for the attempt that is let in. A correct
 * password then clears the count, so signing in often never locks the owner
 * out.
 */
export function createLoginRateLimiter(
  shared: AttemptStore | null,
  fallback: AttemptStore,
  maxAttempts: number = MAX_ATTEMPTS
): LoginRateLimiter {
  async function hit(key: string): Promise<number> {
    if (shared) {
      try {
        return await shared.hit(key);
      } catch (error) {
        console.error("Login rate limit store unavailable; counting on this instance only", error);
      }
    }
    return fallback.hit(key);
  }

  return {
    async allow(key) {
      return (await hit(key)) <= maxAttempts;
    },
    async reset(key) {
      await Promise.all([shared?.clear(key).catch(() => undefined), fallback.clear(key)]);
    },
  };
}

const instanceStore = memoryAttemptStore(WINDOW_SECONDS * 1000);

export function loginRateLimiter(): LoginRateLimiter {
  const redis = getRedis();
  return createLoginRateLimiter(redis ? redisAttemptStore(redis, WINDOW_SECONDS) : null, instanceStore);
}
