import "server-only";
import { getRedis } from "@/lib/cache";
import { mediakitRepository, type MediaKitData } from "./mediakit";

// Deliberately not re-exported from ./index (the shared repository barrel) —
// AppSideBar and other client components import from that barrel, and any
// module they pull in must stay bundler-safe. Reading/writing the media
// kit's draft and published snapshots goes through Redis (Vercel's
// serverless filesystem is read-only, so a local `fs` write only ever works
// in `next dev`), so that logic lives here instead, imported directly by the
// server actions and the public /mediakit page that need it.
const MEDIAKIT_DRAFT_KEY = "mediakit_draft";
const MEDIAKIT_PUBLISHED_KEY = "mediakit_published";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured — set KV_REST_API_URL and KV_REST_API_TOKEN";

// Falls back to the bundled data/mediakit.json seed until the first Save,
// or whenever Redis isn't configured (e.g. local dev without KV env vars).
export async function getMediaKitData(): Promise<MediaKitData> {
  const redis = getRedis();
  if (!redis) return mediakitRepository.get();
  const draft = await redis.get<MediaKitData>(MEDIAKIT_DRAFT_KEY);
  return draft ?? mediakitRepository.get();
}

export async function saveMediaKitData(data: MediaKitData): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  await redis.set(MEDIAKIT_DRAFT_KEY, data);
}

export async function publishMediaKitData(data: MediaKitData): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  await redis.set(MEDIAKIT_PUBLISHED_KEY, data);
}

// Powers the public /mediakit page. Returns null until the first Publish —
// distinct from the draft, which always falls back to the bundled seed.
export async function getPublishedMediaKitData(): Promise<MediaKitData | null> {
  const redis = getRedis();
  if (!redis) return null;
  return (await redis.get<MediaKitData>(MEDIAKIT_PUBLISHED_KEY)) ?? null;
}
