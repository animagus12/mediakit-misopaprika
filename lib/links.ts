import type {
  LinkItem,
  LinkKind,
  LinkProfile,
  LinkSection,
  LinkVariant,
  LinksData,
} from "@/repositories/links";
import type { SocialStats } from "@/repositories/socialStats";

function isVisible(item: LinkItem, now: number): boolean {
  if (!item.enabled) return false;

  // An unparseable date is treated as no bound rather than hiding the item —
  // a typo in one timestamp shouldn't silently drop a link from the page.
  const startsAt = item.startsAt ? Date.parse(item.startsAt) : NaN;
  if (!Number.isNaN(startsAt) && now < startsAt) return false;

  const endsAt = item.endsAt ? Date.parse(item.endsAt) : NaN;
  if (!Number.isNaN(endsAt) && now >= endsAt) return false;

  return true;
}

/**
 * The single place link visibility is decided: disabled items and items
 * outside their scheduled window are dropped, then sections left with no
 * items are dropped too, so the page never renders an empty heading.
 *
 * `now` is passed in rather than read from the clock so callers stay
 * testable and a single render can't straddle a boundary.
 */
export function visibleSections(data: LinksData, now: number): LinkSection[] {
  return data.sections
    .filter((section) => section.enabled)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isVisible(item, now)),
    }))
    .filter((section) => section.items.length > 0);
}

// ---------------------------------------------------------------------------
// Live stat tokens.
//
// A follower count is authored as a placeholder inside otherwise ordinary text
// — "MisoPaprika · {youtube_subscribers}" — and substituted at render. Keeping
// it a token rather than a dedicated field means the author still owns the
// phrasing (handle, separator, order), no schema migration was needed, and the
// same mechanism works in any card's sub-label.
//
// Each token expands to the whole phrase, count *and* noun, so that dropping
// an unavailable one leaves a sentence that still reads: "MisoPaprika" rather
// than "MisoPaprika · subscribers".
// ---------------------------------------------------------------------------

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Adding a platform is one entry here plus one field on SocialStats. */
const STAT_TOKENS: Record<string, (stats: SocialStats) => string | null> = {
  "{youtube_subscribers}": ({ youtubeSubscribers }) =>
    youtubeSubscribers === null ? null : `${formatCount(youtubeSubscribers)} subscribers`,
  "{instagram_followers}": ({ instagramFollowers }) =>
    instagramFollowers === null ? null : `${formatCount(instagramFollowers)} followers`,
};

export const STAT_TOKEN_NAMES = Object.keys(STAT_TOKENS);

/**
 * Tidies what a removed token leaves behind. Only the middot is handled
 * because it is the separator this page's copy uses; anything else is left
 * alone rather than guessed at.
 */
function tidySeparators(text: string): string {
  return text
    .replace(/\s*·\s*·\s*/g, " · ")
    .replace(/^\s*·\s*/, "")
    .replace(/\s*·\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function resolveStatTokens(text: string, stats: SocialStats): string {
  if (!text.includes("{")) return text;

  let resolved = text;
  for (const [token, render] of Object.entries(STAT_TOKENS)) {
    if (!resolved.includes(token)) continue;
    const value = render(stats);
    resolved =
      value === null
        ? tidySeparators(resolved.split(token).join(""))
        : resolved.split(token).join(value);
  }
  return resolved;
}

/**
 * The audience total shown under the profile: summed from whatever platform
 * figures are cached, never authored. It replaced a hand-typed line that sat
 * directly above two cards already carrying these same counts live, so the
 * page had a third number to keep in sync by hand and no way to notice when
 * it drifted.
 *
 * Summed over the stats object's own values rather than a list of platforms
 * repeated here, so adding a platform stays what STAT_TOKENS promises: one
 * entry there plus one field on SocialStats.
 *
 * Null when no platform reported a figure — a normal state (see SocialStats),
 * and the header renders no line at all rather than "0 followers".
 */
export function totalFollowers(stats: SocialStats): string | null {
  const counts = Object.values(stats).filter((count) => typeof count === "number");
  if (counts.length === 0) return null;
  return `${formatCount(counts.reduce((sum, count) => sum + count, 0))} followers`;
}

export interface VisiblePage {
  profile: LinkProfile;
  /** Computed, not authored — see totalFollowers(). */
  followers: string | null;
  sections: LinkSection[];
}

/**
 * Everything the public page should render, in one call: the profile with
 * hidden social icons dropped, the computed follower total, visibleSections(),
 * and live stat tokens resolved. Deliberately a single entry point rather than several — a surface
 * that renders the page shouldn't be able to apply half the rules by
 * forgetting a call, which is why `stats` is required even where the caller
 * has none to give (pass EMPTY_SOCIAL_STATS).
 */
export function visiblePage(data: LinksData, now: number, stats: SocialStats): VisiblePage {
  return {
    profile: {
      ...data.profile,
      socials: data.profile.socials.filter((social) => social.enabled),
    },
    followers: totalFollowers(stats),
    sections: visibleSections(data, now).map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        sublabel: resolveStatTokens(item.sublabel, stats),
      })),
    })),
  };
}

/**
 * visiblePage() against the current time. The clock read lives here rather
 * than in the page because `Date.now()` in a component body is an impure call
 * during render (react-hooks/purity).
 */
export function visiblePageNow(data: LinksData, stats: SocialStats): VisiblePage {
  return visiblePage(data, Date.now(), stats);
}

/** Cards only link out when they have somewhere to go — see LinkItem.url. */
export function isNavigable(item: LinkItem): boolean {
  return item.url.trim().length > 0;
}

export function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

// ---------------------------------------------------------------------------
// Editor helpers. Kept here rather than in the editor components so the shapes
// a new section/item start life with have one definition.
// ---------------------------------------------------------------------------

export const LINK_VARIANT_LABELS: Record<LinkVariant, string> = {
  row: "Text only",
  thumbnail: "Small image",
  banner: "Full-width banner",
};

export const LINK_KIND_LABELS: Record<LinkKind, string> = {
  link: "Link",
  social: "Social profile",
  code: "Creator code",
};

// crypto.randomUUID needs a secure context; the editor runs on https or
// localhost, both of which qualify. The fallback keeps a hostile environment
// from throwing mid-edit rather than guaranteeing uniqueness.
function newId(prefix: string): string {
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${unique}`;
}

export function blankItem(kind: LinkKind = "link"): LinkItem {
  return {
    id: newId("item"),
    kind,
    variant: kind === "code" ? "banner" : "row",
    label: kind === "code" ? "New code" : "New link",
    sublabel: "",
    url: "",
    image: "",
    badge: "",
    code: "",
    enabled: true,
    startsAt: null,
    endsAt: null,
  };
}

export function blankSection(): LinkSection {
  return { id: newId("section"), title: "New section", enabled: true, items: [] };
}

/** Immutable move used by every drag-to-reorder handler in the editor. */
export function moveItem<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return list;
  if (fromIndex >= list.length || toIndex >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
