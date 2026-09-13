// The status vocabulary brand deals (./campaigns) and the creator's own posts
// (./contentPlan) share. Both describe the same work, a piece of content
// moving from a concept to a post, and the content calendar lays them out on
// one pipeline, so they use one set of words for it.
//
// A deal has three statuses an own post never can: Discussion and In Route
// come before there is anything to make (terms being agreed, product on its
// way), and Redacted is the sheet's word for a row written out of the record.
// Everything from Idea on means the same thing in both stores.
//
// Types and a read-side coercion only, and deliberately no "server-only": the
// forms that pick a status are client components.

export type WorkflowStatus =
  | "Discussion"
  | "In Route"
  | "Idea"
  | "Scripting"
  | "Filming"
  | "Editing"
  | "Ready"
  | "Posted"
  | "Cancelled"
  | "Redacted";

/** In pipeline order, so a <Select> and a status sort read the way the work moves. */
export const WORKFLOW_STATUSES: WorkflowStatus[] = [
  "Discussion",
  "In Route",
  "Idea",
  "Scripting",
  "Filming",
  "Editing",
  "Ready",
  "Posted",
  "Cancelled",
  "Redacted",
];

// The words each store used before the two were merged, placed by what they
// meant for the work: the same placement the calendar already gave a deal's
// status on the shared pipeline. Records still carrying one are read through
// this and healed on their next write, the way toInvoiceLink heals the
// pre-split invoice field, so the live store needs no migration.
const LEGACY_STATUSES: Record<string, WorkflowStatus> = {
  brainstorming: "Scripting",
  todo: "Filming",
  "ready to upload": "Ready",
  completed: "Posted",
  dropped: "Cancelled",
};

const BY_NAME = new Map(WORKFLOW_STATUSES.map((status) => [status.toLowerCase(), status]));

/**
 * The status a stored value names, current or legacy, ignoring case and
 * surrounding space. Null for a value neither vocabulary knows, so each store
 * picks its own safe fallback.
 */
export function toWorkflowStatus(raw: string | null | undefined): WorkflowStatus | null {
  const key = raw?.trim().toLowerCase() ?? "";
  return BY_NAME.get(key) ?? LEGACY_STATUSES[key] ?? null;
}
