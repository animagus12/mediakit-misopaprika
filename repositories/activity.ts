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

// The entity and action unions are derived from these maps, so a type or an
// action cannot exist without being registered for isActivity. A hand-kept
// list beside the union is how both affiliate types and all six affiliate
// actions went missing: isActivity drops what is not registered, so every
// affiliate event was written and then silently left out of the feed.
const ENTITY_FLAGS = {
  brand: true,
  agency: true,
  contact: true,
  campaign: true,
  content: true,
  invoice: true,
  editor: true,
  editorTransaction: true,
  affiliatePartner: true,
  affiliatePayout: true,
  payment: true,
  expense: true,
  partnerTransfer: true,
  links: true,
  mediakit: true,
} as const;

export type ActivityEntityType = keyof typeof ENTITY_FLAGS;

// Recorded actions are intent-level. Draft autosaves (saveLinks,
// saveMediaKit, saveInvoiceDefaults) are deliberately absent: a log that
// captures every keystroke-driven save is one nobody reads.
//
// Never remove an action once events carry it: isActivity drops unknown
// actions on read, so removing one deletes that history from the feed. The
// campaign.*payment_* and invoice.paid actions are kept for exactly that
// reason, though payments are now recorded as payment.* events.
const ACTION_FLAGS = {
  "brand.created": true,
  "brand.updated": true,
  "brand.deleted": true,
  "brand.logo_assigned": true,
  "brand.imported": true,
  "agency.created": true,
  "agency.updated": true,
  "contact.created": true,
  "contact.updated": true,
  "contact.deleted": true,
  "campaign.created": true,
  "campaign.updated": true,
  "campaign.deleted": true,
  "campaign.payment_received": true,
  "campaign.payment_reverted": true,
  "campaign.scheduled": true,
  "campaign.unscheduled": true,
  "campaign.usage_paused": true,
  "campaign.usage_resumed": true,
  "campaign.usage_ended": true,
  "campaign.usage_renewed": true,
  "campaign.usage_payment_received": true,
  "campaign.usage_payment_reverted": true,
  "content.created": true,
  "content.updated": true,
  "content.deleted": true,
  "content.scheduled": true,
  "content.unscheduled": true,
  "invoice.created": true,
  "invoice.updated": true,
  "invoice.paid": true,
  "invoice.deleted": true,
  "editor.created": true,
  "editor.updated": true,
  "editor.renamed": true,
  "editorTransaction.created": true,
  "editorTransaction.updated": true,
  "editorTransaction.deleted": true,
  "affiliatePartner.created": true,
  "affiliatePartner.updated": true,
  "affiliatePayout.created": true,
  "affiliatePayout.updated": true,
  "affiliatePayout.paid": true,
  "affiliatePayout.deleted": true,
  "payment.recorded": true,
  "payment.updated": true,
  "payment.deleted": true,
  "payment.restored": true,
  "expense.recorded": true,
  "expense.updated": true,
  "expense.deleted": true,
  "expense.restored": true,
  "partnerTransfer.recorded": true,
  "partnerTransfer.deleted": true,
  "links.published": true,
  "mediakit.published": true,
} as const;

export type ActivityAction = keyof typeof ACTION_FLAGS;

export const activityActions = Object.keys(ACTION_FLAGS) as readonly ActivityAction[];

const ENTITY_TYPES: ReadonlySet<string> = new Set(Object.keys(ENTITY_FLAGS));
const ACTIONS: ReadonlySet<string> = new Set(activityActions);

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
  /**
   * The record the entity belongs to, where it has no page of its own: a
   * payment's deal or invoice. Snapshotted like `entity`, never joined.
   */
  parent?: ActivityEntity;
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
  if (!isActivityEntity(candidate.entity)) return false;
  return candidate.parent === undefined || isActivityEntity(candidate.parent);
}

function isActivityEntity(value: unknown): value is ActivityEntity {
  if (typeof value !== "object" || value === null) return false;
  const entity = value as Partial<ActivityEntity>;
  if (typeof entity.type !== "string" || !ENTITY_TYPES.has(entity.type)) return false;
  if (entity.id !== null && typeof entity.id !== "string") return false;
  return typeof entity.label === "string";
}
