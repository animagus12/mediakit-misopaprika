import "server-only";
import { Redis } from "@upstash/redis";
import { requireRedis } from "./cache";
import { createMutate, type CompareAndSetStore, type Decode, type Mutation } from "./storeMutation";

// Binds ./storeMutation to Upstash. Over REST there is no WATCH, and MULTI on
// its own cannot see a write that landed between the read and the write, so
// the check and the write run as one Lua script on the server instead.
//
// The script compares against the exact text that was read rather than a
// version counter kept beside each key. That needs no extra keys and catches
// a write from anywhere, a backup restore included, at the cost of sending
// the text read along with the text to write.
//
// When the key already holds exactly the text to write, the script answers
// success without writing. That keeps a retried request idempotent: the
// client resends a command whose reply was lost, and the resent copy would
// otherwise see its own first write as a conflict and apply the change twice.
const COMPARE_AND_SET = `
local current = redis.call('GET', KEYS[1])
if current == ARGV[3] then return 1 end
if ARGV[1] == '1' then
  if current ~= ARGV[2] then return 0 end
elseif current then
  return 0
end
redis.call('SET', KEYS[1], ARGV[3])
return 1
`;

// The app's client parses every value it reads, and a parsed array cannot be
// compared against the stored text. This second client over the same store
// hands strings back as stored; it is used for that read and nothing else.
let raw: { redis: Redis; text: Redis } | null = null;

function clients(): { redis: Redis; text: Redis } {
  const redis = requireRedis();
  if (raw?.redis !== redis) {
    // requireRedis has just checked both are set; getRedis builds a new
    // client whenever either changes, which makes this one stale too.
    const url = process.env.KV_REST_API_URL ?? "";
    const token = process.env.KV_REST_API_TOKEN ?? "";
    raw = { redis, text: new Redis({ url, token, automaticDeserialization: false }) };
  }
  return raw;
}

const upstashStore: CompareAndSetStore = {
  async read(key) {
    const { redis, text } = clients();
    // Read no older than the last write the app's client saw, so a change
    // made earlier in this process is never read back stale from a replica.
    text.readYourWritesSyncToken = redis.readYourWritesSyncToken;
    const value = await text.get<string>(key);
    return value ?? null;
  },
  async compareAndSet(key, expected, next) {
    // Through the app's client, so its next read waits for this write.
    const { redis } = clients();
    const args = expected === null ? ["0", "", next] : ["1", expected, next];
    return Number(await redis.eval(COMPARE_AND_SET, [key], args)) === 1;
  },
};

const mutate = createMutate(upstashStore);

/**
 * Changes the value under `key` by compare-and-set: `change` runs against a
 * fresh read (never a copy cached for the render), and its result is written
 * only if nothing else wrote the key meanwhile. On a conflict the change runs
 * again against what is stored now; after a few tries it throws
 * STORE_CONFLICT.
 *
 * Throws, as requireRedis does, when the store is not configured.
 */
export function mutateStored<T, R>(key: string, decode: Decode<T>, change: Mutation<T, R>): Promise<R> {
  return mutate(key, decode, change);
}
