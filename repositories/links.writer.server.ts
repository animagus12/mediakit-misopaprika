import "server-only";
import { getRedis } from "@/lib/cache";
import { linksRepository, normalizeLinksData, type LinksData } from "./links";
import type {
  LinkTrashDeletion,
  LinkTrashTarget,
} from "./trash";

// Same split as mediakit.writer.server.ts, and server-only for the same
// reason: this module must never be reachable from a client component.
const LINKS_DRAFT_KEY = "links_draft";
const LINKS_PUBLISHED_KEY = "links_published";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";

// Falls back to the bundled data/links.json seed until the first Save, or
// whenever Redis isn't configured (e.g. local dev without KV env vars).
export async function getLinksData(): Promise<LinksData> {
  const redis = getRedis();
  if (!redis) return linksRepository.get();
  const draft = await redis.get<Parameters<typeof normalizeLinksData>[0]>(LINKS_DRAFT_KEY);
  return draft ? normalizeLinksData(draft) : linksRepository.get();
}

export async function saveLinksData(data: LinksData): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  await redis.set(LINKS_DRAFT_KEY, data);
}

export async function publishLinksData(data: LinksData): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  await redis.set(LINKS_PUBLISHED_KEY, data);
}

export async function restoreLinksDeletion(
  deletion: LinkTrashDeletion,
  target: LinkTrashTarget
): Promise<void> {
  const current = target === "draft" ? await getLinksData() : await getPublishedLinksData();
  let updated: LinksData;

  switch (deletion.type) {
    case "linksSection": {
      if (current.sections.some((section) => section.id === deletion.record.id)) return;
      const sections = [...current.sections];
      sections.splice(Math.max(0, Math.min(deletion.index, sections.length)), 0, deletion.record);
      updated = { ...current, sections };
      break;
    }
    case "linksItem": {
      const sectionIndex = current.sections.findIndex((section) => section.id === deletion.sectionId);
      if (sectionIndex < 0) throw new Error("Restore the link's section first");
      const section = current.sections[sectionIndex];
      if (section.items.some((item) => item.id === deletion.record.id)) return;
      const items = [...section.items];
      items.splice(Math.max(0, Math.min(deletion.index, items.length)), 0, deletion.record);
      const sections = [...current.sections];
      sections[sectionIndex] = { ...section, items };
      updated = { ...current, sections };
      break;
    }
    case "linksSocial": {
      const socials = [...current.profile.socials];
      if (
        socials.some(
          (social) =>
            social.platform === deletion.record.platform &&
            social.url === deletion.record.url &&
            social.enabled === deletion.record.enabled
        )
      ) {
        return;
      }
      socials.splice(Math.max(0, Math.min(deletion.index, socials.length)), 0, deletion.record);
      updated = { ...current, profile: { ...current.profile, socials } };
      break;
    }
  }

  if (target === "draft") await saveLinksData(updated);
  else await publishLinksData(updated);
}

// Powers the public /links page. Unlike the media kit's equivalent: which
// returns null and 404s until the first Publish: this falls back to the
// bundled seed, because that seed is real content: the page was live off it
// before any editor existed, and a deploy shouldn't take it down while
// waiting for someone to press Publish.
export async function getPublishedLinksData(): Promise<LinksData> {
  const redis = getRedis();
  if (!redis) return linksRepository.get();
  const published = await redis.get<Parameters<typeof normalizeLinksData>[0]>(LINKS_PUBLISHED_KEY);
  return published ? normalizeLinksData(published) : linksRepository.get();
}
