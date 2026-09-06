import { Building2, Clapperboard, FileText, Handshake, LayoutDashboard, Link2, Sparkles, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Sidebar sections. Grouping lives here rather than in the sidebar component
// so every consumer of navEntries sees the same taxonomy.
export type NavGroup = "manage" | "create" | "public";

export const navGroups: { id: NavGroup; label: string }[] = [
  { id: "manage", label: "Manage" },
  { id: "create", label: "Create" },
  { id: "public", label: "Public pages" },
];

export interface NavEntry {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  access: "public" | "protected";
  group: NavGroup;
}

export const navEntries: NavEntry[] = [
  {
    href: "/mediakit",
    title: "Media kit",
    description: "Public, shareable view of your published media kit.",
    Icon: UserRound,
    access: "public",
    group: "public",
  },
  {
    href: "/links",
    title: "Links",
    description: "Public link-in-bio page for socials, creator codes, and collabs.",
    Icon: Link2,
    access: "public",
    group: "public",
  },
  {
    href: "/links-editor",
    title: "Edit Links",
    description: "Edit sections, links, and creator codes on your links page.",
    Icon: Link2,
    access: "protected",
    group: "create",
  },
  {
    href: "/mediakit-generator",
    title: "Edit Media kit",
    description: "Edit and publish the content shown on your media kit.",
    Icon: Sparkles,
    access: "protected",
    group: "create",
  },
  {
    href: "/campaigns",
    title: "Campaigns",
    description: "Every brand collaboration on record, in one table.",
    Icon: Handshake,
    access: "protected",
    group: "manage",
  },
  {
    href: "/invoices",
    title: "Invoices",
    description: "Create, revisit, and edit invoices for brand collaborations.",
    Icon: FileText,
    access: "protected",
    group: "manage",
  },
  {
    href: "/workspace",
    title: "Editor workspace",
    description: "Track video editing transactions and editor payouts.",
    Icon: Clapperboard,
    access: "protected",
    group: "manage",
  },
  {
    href: "/brands",
    title: "Brands",
    description: "Manage brand, agency, and contact relationships.",
    Icon: Building2,
    access: "protected",
    group: "manage",
  },
];

// The dashboard has no card on the dashboard page itself, so it is not one of
// navEntries: but the sidebar and the top bar both have to name it.
export const dashboardEntry: Pick<NavEntry, "href" | "title" | "Icon"> = {
  href: "/",
  title: "Dashboard",
  Icon: LayoutDashboard,
};

// "/" matches only itself; every other entry also owns its nested routes, so
// /invoices/new resolves to Invoices. The trailing slash keeps /links-editor
// from matching /links.
export function isNavHrefActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Longest href wins, so a nested entry added later beats its parent rather than
// resolving to whichever happens to be declared first.
export function currentNavTitle(pathname: string): string | null {
  const matches = [dashboardEntry, ...navEntries].filter((entry) =>
    isNavHrefActive(pathname, entry.href)
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, entry) => (entry.href.length > best.href.length ? entry : best)).title;
}
