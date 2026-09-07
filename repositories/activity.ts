// Append-only record of what the creator did in the app: the audit trail
// behind the dashboard's recent-activity card, /activity and /api/activity.
//
// Types only, and deliberately no "server-only": lib/activity.ts turns an
// event into a sentence and the feed components render it, both client-safe.
// Reading and writing lives in ./activity.writer.server.
//
// Events are recorded by the server actions, not by the writer repositories
// underneath them. A repository only ever sees "the brands array was
// written"; the action knows that importBrandsFromCampaigns is one thing the
// creator did rather than twelve, and that renaming an editor plus moving
// their transactions is a single intent. Same reasoning, and the same layer,
// as lib/revalidation.ts.

export type ActivityEntityType =
  | "brand"
  | "agency"
  | "contact"
  | "campaign"
  | "content"
  | "invoice"
  | "editor"
  | "editorTransaction"
  | "links"
  | "mediakit";

// Recorded actions are intent-level. Draft autosaves (saveLinks,
// saveMediaKit, saveInvoiceDefaults) are deliberately absent: a log that
// captures every keystroke-driven save is one nobody reads.
export type ActivityAction =
  | "brand.created"
  | "brand.updated"
  | "brand.deleted"
  | "brand.logo_assigned"
  | "brand.imported"
  | "agency.created"
  | "agency.updated"
  | "contact.created"
  | "contact.updated"
  | "contact.deleted"
  | "campaign.created"
  | "campaign.updated"
  | "campaign.payment_received"
  | "campaign.payment_reverted"
  | "campaign.scheduled"
  | "campaign.unscheduled"
  | "campaign.usage_paused"
  | "campaign.usage_resumed"
  | "campaign.usage_ended"
  | "campaign.usage_renewed"
  | "campaign.usage_payment_received"
  | "campaign.usage_payment_reverted"
  | "content.created"
  | "content.updated"
  | "content.deleted"
  | "content.scheduled"
  | "content.unscheduled"
  | "invoice.created"
  | "invoice.updated"
  | "invoice.paid"
  | "invoice.deleted"
  | "editor.created"
  | "editor.updated"
  | "editor.renamed"
  | "editorTransaction.created"
  | "editorTransaction.updated"
  | "editorTransaction.deleted"
  | "links.published"
  | "mediakit.published";

export const activityActions: readonly ActivityAction[] = [
  "brand.created",
  "brand.updated",
  "brand.deleted",
  "brand.logo_assigned",
  "brand.imported",
  "agency.created",
  "agency.updated",
  "contact.created",
  "contact.updated",
  "contact.deleted",
  "campaign.created",
  "campaign.updated",
  "campaign.payment_received",
  "campaign.payment_reverted",
  "campaign.scheduled",
  "campaign.unscheduled",
  "campaign.usage_paused",
  "campaign.usage_resumed",
  "campaign.usage_ended",
  "campaign.usage_renewed",
  "campaign.usage_payment_received",
  "campaign.usage_payment_reverted",
  "content.created",
  "content.updated",
  "content.deleted",
  "content.scheduled",
  "content.unscheduled",
  "invoice.created",
  "invoice.updated",
  "invoice.paid",
  "invoice.deleted",
  "editor.created",
  "editor.updated",
  "editor.renamed",
  "editorTransaction.created",
  "editorTransaction.updated",
  "editorTransaction.deleted",
  "links.published",
  "mediakit.published",
] as const;

export interface ActivityEntity {
  type: ActivityEntityType;
  /**
   * The record's id, or null for the singletons (the links page, the media
   * kit) and for events that span a set rather than one record.
   *
   * Deliberately not a stored href: a route is derived from this at render
   * time (see lib/activity.ts), so reorganising the app's URLs doesn't leave
   * a trail of permanently broken history behind it.
   */
  id: string | null;
  /**
   * The record's name as it read when the event happened, not a live join.
   *
   * Half of these events refer to something since renamed or deleted, and an
   * audit trail's whole job is to show what was true then. Joining at read
   * time would blank out every deletion and quietly rewrite history on every
   * rename.
   */
  label: string;
}

export interface Activity {
  id: string;
  at: string; // ISO datetime
  action: ActivityAction;
  entity: ActivityEntity;
  /**
   * Domain-level extra, already a phrase and never a full sentence:
   * "12 transactions moved", "6 sections, 14 links". lib/activity.ts writes
   * the sentence around it.
   */
  detail?: string;
  /** Only where money is the point of the event, for display alongside it. */
  amount?: number;
}

/** id and at are stamped by recordActivity, so call sites never pass them. */
export type NewActivity = Omit<Activity, "id" | "at">;

export interface ActivityPage {
  items: Activity[];
  /** Events matching this query, not the size of the whole log, so a filtered
   *  view can say how many it actually has. */
  total: number;
  /** Offset for the next page, or null when this page reached the end. */
  nextOffset: number | null;
}

const ENTITY_TYPES = new Set<string>([
  "brand",
  "agency",
  "contact",
  "campaign",
  "content",
  "invoice",
  "editor",
  "editorTransaction",
  "links",
  "mediakit",
]);

const ACTIONS = new Set<string>(activityActions);

export function isActivityEntityType(value: string): value is ActivityEntityType {
  return ENTITY_TYPES.has(value);
}

/**
 * Whether a value read back out of storage is a usable event.
 *
 * The log outlives the code that wrote it: an entry recorded by an older
 * deploy can name an action this one has since dropped. Validating on read
 * means one stale row is skipped rather than rendering as undefined, and the
 * rest of the feed still paints.
 */
export function isActivity(value: unknown): value is Activity {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Activity>;
  if (typeof candidate.id !== "string" || typeof candidate.at !== "string") return false;
  if (typeof candidate.action !== "string" || !ACTIONS.has(candidate.action)) return false;
  const entity = candidate.entity;
  if (typeof entity !== "object" || entity === null) return false;
  if (typeof entity.type !== "string" || !ENTITY_TYPES.has(entity.type)) return false;
  if (entity.id !== null && typeof entity.id !== "string") return false;
  return typeof entity.label === "string";
}
