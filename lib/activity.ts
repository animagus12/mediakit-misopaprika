import {
  Building2,
  Clapperboard,
  FileText,
  Handshake,
  Link2,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CALENDAR_TIME_ZONE, dayKeyOf } from "@/lib/day";
import type {
  Activity,
  ActivityAction,
  ActivityEntity,
  ActivityEntityType,
} from "@/repositories/activity";

// Turns a stored event into something renderable. Client-safe, and kept out
// of the feed components on purpose: the repository stores structure, the UI
// renders, and every "what does this event say" decision lives here, in one
// file, rather than in a switch inside a component.

export type ActivityTone = "default" | "positive" | "destructive";

export interface ActivityDescription {
  title: string;
  /** Where the row links, or null when the record no longer exists. */
  href: string | null;
  Icon: LucideIcon;
  tone: ActivityTone;
}

// A Record keyed by ActivityAction rather than a switch with a default:
// adding an action to the union then fails the build here until it has been
// given words, which is the only thing keeping a new event from rendering as
// a blank row six months from now.
const TITLES: Record<ActivityAction, (label: string) => string> = {
  "brand.created": (label) => `Brand ${label} added`,
  "brand.updated": (label) => `Brand ${label} updated`,
  "brand.deleted": (label) => `Brand ${label} deleted`,
  "brand.logo_assigned": (label) => `Logo set for ${label}`,
  "brand.imported": () => "Brands imported from campaigns",
  "agency.created": (label) => `Agency ${label} added`,
  "agency.updated": (label) => `Agency ${label} updated`,
  "contact.created": (label) => `Contact ${label} added`,
  "contact.updated": (label) => `Contact ${label} updated`,
  "contact.deleted": (label) => `Contact ${label} deleted`,
  "campaign.created": (label) => `Campaign ${label} created`,
  "campaign.updated": (label) => `Campaign ${label} updated`,
  "campaign.payment_received": (label) => `Payment received for ${label}`,
  "campaign.payment_reverted": (label) => `Payment reverted on ${label}`,
  "campaign.scheduled": (label) => `${label} scheduled to post`,
  "campaign.unscheduled": (label) => `Posting date cleared on ${label}`,
  "campaign.usage_paused": (label) => `Ad usage paused on ${label}`,
  "campaign.usage_resumed": (label) => `Ad usage resumed on ${label}`,
  "campaign.usage_ended": (label) => `Ad usage ended on ${label}`,
  "campaign.usage_renewed": (label) => `Ad usage renewed on ${label}`,
  "campaign.usage_payment_received": (label) => `Renewal payment received for ${label}`,
  "campaign.usage_payment_reverted": (label) => `Renewal payment reverted on ${label}`,
  "content.created": (label) => `${label} added to the content plan`,
  "content.updated": (label) => `${label} updated`,
  "content.deleted": (label) => `${label} removed from the content plan`,
  "content.scheduled": (label) => `${label} scheduled to post`,
  "content.unscheduled": (label) => `Posting date cleared on ${label}`,
  "invoice.created": (label) => `Invoice ${label} created`,
  "invoice.updated": (label) => `Invoice ${label} updated`,
  "invoice.paid": (label) => `Invoice ${label} marked paid`,
  "invoice.deleted": (label) => `Invoice ${label} deleted`,
  "editor.created": (label) => `Editor ${label} added`,
  "editor.updated": (label) => `Editor ${label} updated`,
  "editor.renamed": (label) => `Editor renamed to ${label}`,
  "editorTransaction.created": (label) => `Editing job ${label} added`,
  "editorTransaction.updated": (label) => `Editing job ${label} updated`,
  "editorTransaction.deleted": (label) => `Editing job ${label} deleted`,
  "links.published": () => "Links page published",
  "mediakit.published": () => "Media kit published",
};

// Only the events that carry weight get a colour; everything else stays
// muted, so the two that matter are findable by scanning. Following the
// destructive-variant shape used elsewhere, since globals.css has no success
// token.
const TONES: Partial<Record<ActivityAction, ActivityTone>> = {
  "campaign.payment_received": "positive",
  "campaign.usage_payment_received": "positive",
  "campaign.usage_renewed": "positive",
  "invoice.paid": "positive",
  "brand.deleted": "destructive",
  "contact.deleted": "destructive",
  "invoice.deleted": "destructive",
  "editorTransaction.deleted": "destructive",
  "content.deleted": "destructive",
};

// Icons follow the entity, not the action, so the same kind of record always
// looks the same, and they are the icons lib/navigation.ts already gives
// those destinations.
const ICONS: Record<ActivityEntityType, LucideIcon> = {
  brand: Building2,
  agency: Building2,
  contact: UserRound,
  campaign: Handshake,
  content: Video,
  invoice: FileText,
  editor: Clapperboard,
  editorTransaction: Clapperboard,
  links: Link2,
  mediakit: Sparkles,
};

// Where the entity's own page lives, and where its list lives. A deleted
// record still has an id, so the detail route would 404: deletions fall back
// to the list, which is the useful destination anyway.
const ROUTES: Record<ActivityEntityType, { detail: ((id: string) => string) | null; list: string }> = {
  brand: { detail: (id) => `/brands/${id}`, list: "/brands" },
  agency: { detail: null, list: "/brands" },
  contact: { detail: null, list: "/brands" },
  campaign: { detail: null, list: "/campaigns" },
  content: { detail: null, list: "/calendar" },
  invoice: { detail: (id) => `/invoices/${id}`, list: "/invoices" },
  editor: { detail: null, list: "/workspace" },
  editorTransaction: { detail: null, list: "/workspace" },
  links: { detail: null, list: "/links-editor" },
  mediakit: { detail: null, list: "/mediakit-generator" },
};

function activityHref(action: ActivityAction, entity: ActivityEntity): string {
  const route = ROUTES[entity.type];
  if (action.endsWith(".deleted") || !entity.id || !route.detail) return route.list;
  return route.detail(entity.id);
}

// The /activity filter bar, and the only place entity types are bundled into
// something a person would think of as a category. Kept next to the mapping
// above rather than in the page, so the tab list and the query it produces
// cannot disagree.
export interface ActivityFilter {
  id: string;
  label: string;
  types: readonly ActivityEntityType[];
}

export const activityFilters: readonly ActivityFilter[] = [
  { id: "all", label: "All", types: [] },
  { id: "brands", label: "Brands", types: ["brand", "agency", "contact"] },
  { id: "campaigns", label: "Campaigns", types: ["campaign"] },
  { id: "content", label: "Content", types: ["content"] },
  { id: "invoices", label: "Invoices", types: ["invoice"] },
  { id: "workspace", label: "Workspace", types: ["editor", "editorTransaction"] },
  { id: "publishing", label: "Publishing", types: ["links", "mediakit"] },
];

/** Falls back to "all" for an absent or unrecognised query string. */
export function resolveActivityFilter(id: string | undefined): ActivityFilter {
  return activityFilters.find((filter) => filter.id === id) ?? activityFilters[0];
}

export function describeActivity(activity: Activity): ActivityDescription {
  const { action, entity } = activity;
  return {
    title: TITLES[action](entity.label),
    href: activityHref(action, entity),
    Icon: ICONS[entity.type],
    tone: TONES[action] ?? "default",
  };
}

// One fixed zone, not the viewer's and not UTC.
//
// UTC is what SocialRowNotes uses, because it is a client component and a
// viewer's timezone would change the string between the server render and
// hydration. Nothing here has that problem: every activity component is a
// server component, so the string is produced once. And UTC is actively
// wrong for the reader, who is in IST: an edit made at 01:00 files under the
// previous day, because 01:00 IST is 19:30 UTC the day before.
//
// The locale stays fixed for the same reason it is fixed elsewhere: the
// output should not depend on where the page is rendered.
// The zone itself lives in lib/day.ts, which the content calendar shares:
// one definition of "which day is it for the reader", not two that can drift.
const TIME_ZONE = CALENDAR_TIME_ZONE;

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
});

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

export function formatActivityTime(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? "" : TIME.format(date);
}

/** Matches the wording LastRefreshed already uses on the dashboard. */
export function formatActivityAge(at: string, now: Date = new Date()): string {
  const then = new Date(at).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((now.getTime() - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return DAY.format(new Date(then));
}

export interface ActivityDay {
  /** yyyy-mm-dd in TIME_ZONE, stable enough to key a list on. */
  key: string;
  label: string;
  items: Activity[];
}

/**
 * Groups an already-sorted (newest first) list under day headings, preserving
 * order. Day boundaries are TIME_ZONE's, so "Today" means today where the
 * reader is rather than where the server happens to run.
 */
export function groupActivitiesByDay(items: Activity[], now: Date = new Date()): ActivityDay[] {
  const today = dayKeyOf(now);
  const yesterday = dayKeyOf(new Date(now.getTime() - 86_400_000));

  const days: ActivityDay[] = [];
  for (const item of items) {
    const key = dayKeyOf(item.at);
    const last = days[days.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
      continue;
    }
    const label =
      key === today ? "Today" : key === yesterday ? "Yesterday" : DAY.format(new Date(item.at));
    days.push({ key, label, items: [item] });
  }
  return days;
}
