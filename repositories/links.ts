import linksJson from "@/data/links.json";

// "link"   — a plain destination card
// "social" — a platform profile; rendered with that platform's icon
// "code"   — a creator/affiliate code, copyable, with an optional destination
export type LinkKind = "link" | "social" | "code";

// How a card is laid out, chosen per item in the editor:
//   "row"       — text only
//   "thumbnail" — small round image (or the platform mark) at the left
//   "banner"    — full-width brand image above the text
export type LinkVariant = "row" | "thumbnail" | "banner";

export const LINK_KINDS: LinkKind[] = ["link", "social", "code"];
export const LINK_VARIANTS: LinkVariant[] = ["row", "thumbnail", "banner"];

export interface SocialHandle {
  platform: string;
  url: string;
  // Same reversible hide as sections and items: takes the icon off the page
  // without discarding the URL behind it.
  enabled: boolean;
}

export interface LinkProfile {
  displayName: string;
  tagline: string;
  avatar: string;
  followers: string;
  socials: SocialHandle[];
}

export interface LinkItem {
  // Stable across edits — links are reordered and retitled freely, so click
  // counts and any future per-link state key off this rather than the label.
  id: string;
  kind: LinkKind;
  variant: LinkVariant;
  label: string;
  sublabel: string;
  // Internal ("/mediakit") or external. Empty means the card isn't a link:
  // a creator code with nowhere to send people is still worth showing.
  url: string;
  // One image per link. `variant` decides how it's shown — cropped round at
  // 52px for "thumbnail", full width for "banner" — so switching layout keeps
  // the picture instead of pointing at a second, empty slot.
  image: string;
  badge: string;
  code: string;
  enabled: boolean;
  // ISO timestamps bounding when the item is shown; null on either side
  // means unbounded. Applied by visibleSections() in @/lib/links.
  startsAt: string | null;
  endsAt: string | null;
}

export interface LinkSection {
  id: string;
  title: string;
  // Hiding a section hides everything in it without deleting anything, so a
  // seasonal block can be switched off and back on. Item-level `enabled`
  // works the same way one level down.
  enabled: boolean;
  items: LinkItem[];
}

export interface LinksData {
  profile: LinkProfile;
  sections: LinkSection[];
}

// What may come back out of storage: records written by an older build of the
// editor, so anything added since is optional here. Kept separate from
// LinkItem so the rest of the app never has to think about the older shapes.
interface StoredLinkItem extends Partial<Omit<LinkItem, "id">> {
  id: string;
  /** Pre-migration records carried two image slots instead of one. */
  thumbnail?: string;
  banner?: string;
}

interface StoredLinkSection extends Partial<Omit<LinkSection, "id" | "items">> {
  id: string;
  items?: StoredLinkItem[];
}

interface StoredSocialHandle extends Partial<SocialHandle> {
  platform: string;
  url: string;
}

interface StoredLinksData {
  profile?: Omit<Partial<LinkProfile>, "socials"> & { socials?: StoredSocialHandle[] };
  sections?: StoredLinkSection[];
}

function normalizeItem(item: StoredLinkItem): LinkItem {
  // Pre-migration records can have BOTH slots filled with different images —
  // that is what uploading under one layout and then re-uploading after
  // switching produced. Read the slot that item's own layout was rendering,
  // so migrating never silently swaps the picture someone is looking at; the
  // other slot is only a fallback.
  const legacyImage =
    item.variant === "banner" ? item.banner || item.thumbnail : item.thumbnail || item.banner;
  const image = item.image || legacyImage || "";

  return {
    id: item.id,
    kind: item.kind ?? "link",
    variant: item.variant ?? (image ? "thumbnail" : "row"),
    label: item.label ?? "",
    sublabel: item.sublabel ?? "",
    url: item.url ?? "",
    image,
    badge: item.badge ?? "",
    code: item.code ?? "",
    enabled: item.enabled ?? true,
    startsAt: item.startsAt ?? null,
    endsAt: item.endsAt ?? null,
  };
}

/**
 * Reshapes whatever storage returns into the current LinkItem/LinkSection
 * contract. Every read path goes through this — the bundled seed and both
 * Redis snapshots — because a published snapshot can outlive several schema
 * changes, and a missing field would otherwise reach the page as undefined.
 */
export function normalizeLinksData(data: StoredLinksData): LinksData {
  return {
    profile: {
      displayName: data.profile?.displayName ?? "",
      tagline: data.profile?.tagline ?? "",
      avatar: data.profile?.avatar ?? "",
      followers: data.profile?.followers ?? "",
      socials: (data.profile?.socials ?? []).map((social) => ({
        platform: social.platform,
        url: social.url,
        // Records written before socials could be hidden are all visible.
        enabled: social.enabled ?? true,
      })),
    },
    sections: (data.sections ?? []).map((section) => ({
      id: section.id,
      title: section.title ?? "",
      enabled: section.enabled ?? true,
      items: (section.items ?? []).map(normalizeItem),
    })),
  };
}

export interface ILinksRepository {
  get(): LinksData;
}

class JsonLinksRepository implements ILinksRepository {
  get(): LinksData {
    return normalizeLinksData(linksJson as StoredLinksData);
  }
}

export const linksRepository: ILinksRepository = new JsonLinksRepository();
