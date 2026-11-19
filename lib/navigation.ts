import {
  BadgePercent,
  Building2,
  CalendarDays,
  Clapperboard,
  DatabaseBackup,
  FileText,
  Handshake,
  History,
  House,
  IndianRupee,
  Link2,
  ReceiptText,
  Trash2,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Sidebar sections, grouped by the job a page is for rather than by who can
// see it. Grouping lives here rather than in the sidebar component so every
// consumer of navEntries sees the same taxonomy.
export type NavGroup = "work" | "money" | "publish";

export const navGroups: { id: NavGroup; label: string }[] = [
  { id: "work", label: "Work" },
  { id: "money", label: "Money" },
  { id: "publish", label: "Publish" },
];

export interface NavEntry {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  group: NavGroup;
  /**
   * The public page this entry edits. The sidebar row opens the editor and
   * carries a "view live" link to this, so each public page is one row
   * rather than an editor row plus a viewer row.
   */
  liveHref?: string;
  /**
   * What a route nested under `href` is called, from its first segment past
   * `href` ("new", or a record id). Without it a nested route is named after
   * its section alone.
   */
  childTitle?: (segment: string) => string;
}

export const navEntries: NavEntry[] = [
  {
    href: "/campaigns",
    title: "Campaigns",
    description: "Every brand collaboration on record, in one table.",
    Icon: Handshake,
    group: "work",
  },
  {
    href: "/calendar",
    title: "Content calendar",
    description: "Plan your own reels and brand deals on one calendar.",
    Icon: CalendarDays,
    group: "work",
  },
  {
    href: "/brands",
    title: "Brands",
    description: "Manage brand, agency, and contact relationships.",
    Icon: Building2,
    group: "work",
    childTitle: () => "Brand details",
  },
  {
    href: "/invoices",
    title: "Invoices",
    description: "Create, revisit, and edit invoices for brand collaborations.",
    Icon: FileText,
    group: "money",
    childTitle: (segment) => (segment === "new" ? "New invoice" : "Edit invoice"),
  },
  {
    href: "/payments",
    title: "Payments",
    description: "Money in from brands and money out on editing and expenses, by financial year.",
    Icon: IndianRupee,
    group: "money",
  },
  {
    href: "/taxes",
    title: "TDS & tax",
    description: "Review TDS withheld from brand payments by financial year.",
    Icon: ReceiptText,
    group: "money",
  },
  {
    href: "/affiliates",
    title: "Affiliates",
    description: "Creator codes, commission periods, and how well each code converts.",
    Icon: BadgePercent,
    group: "money",
  },
  {
    href: "/workspace",
    title: "Editor workspace",
    description: "Track video editing transactions and editor payouts.",
    Icon: Clapperboard,
    group: "money",
  },
  {
    href: "/mediakit-generator",
    title: "Media kit",
    description: "Edit and publish the content shown on your media kit.",
    Icon: UserRound,
    group: "publish",
    liveHref: "/mediakit",
  },
  {
    href: "/links-editor",
    title: "Links page",
    description: "Edit sections, links, and creator codes on your links page.",
    Icon: Link2,
    group: "publish",
    liveHref: "/links",
  },
];

// Housekeeping pages: reached from the account menu at the foot of the
// sidebar, not given rows of their own, since they are visited rarely and on
// purpose.
export const accountEntries: Pick<NavEntry, "href" | "title" | "Icon">[] = [
  { href: "/activity", title: "Activity", Icon: History },
  { href: "/trash", title: "Trash", Icon: Trash2 },
  { href: "/backup", title: "Backup & restore", Icon: DatabaseBackup },
];

// The dashboard has no card on the dashboard page itself, so it is not one of
// navEntries: but the sidebar, the top bar and the phone tab bar all name it.
export const dashboardEntry: Pick<NavEntry, "href" | "title" | "Icon"> = {
  href: "/",
  title: "Home",
  Icon: House,
};

// "/" matches only itself; every other entry also owns its nested routes, so
// /invoices/new resolves to Invoices. The trailing slash keeps /links-editor
// from matching /links.
export function isNavHrefActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

type TitledEntry = Pick<NavEntry, "href" | "title"> & Partial<Pick<NavEntry, "childTitle">>;

const allEntries: TitledEntry[] = [dashboardEntry, ...navEntries, ...accountEntries];

// Longest href wins, so a nested entry added later beats its parent rather than
// resolving to whichever happens to be declared first.
function matchEntry(pathname: string): TitledEntry | null {
  const matches = allEntries.filter((entry) => isNavHrefActive(pathname, entry.href));
  if (matches.length === 0) return null;
  return matches.reduce((best, entry) => (entry.href.length > best.href.length ? entry : best));
}

export function currentNavTitle(pathname: string): string | null {
  return matchEntry(pathname)?.title ?? null;
}

export interface NavTrail {
  /** The section a nested page belongs to, linked so the top bar can lead back to it. */
  parent: { href: string; title: string } | null;
  /** What the current page is called. */
  title: string;
}

/**
 * What the top bar shows for a page: its section's title, or for a page
 * nested in a section (a brand, a new or saved invoice) the section as a link
 * back and the page's own name after it.
 */
export function currentNavTrail(pathname: string): NavTrail | null {
  const entry = matchEntry(pathname);
  if (!entry) return null;
  if (pathname === entry.href || entry.href === "/") return { parent: null, title: entry.title };
  const segment = pathname.slice(entry.href.length + 1).split("/")[0];
  if (!entry.childTitle || !segment) return { parent: null, title: entry.title };
  return { parent: { href: entry.href, title: entry.title }, title: entry.childTitle(segment) };
}
