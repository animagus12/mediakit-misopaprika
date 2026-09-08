import { parseSheetDate } from "@/lib/editorTransactions";
import type {
  ContentFormat,
  ContentItem,
  ContentStatus,
} from "@/repositories/contentPlan";
import type { EditorTransactionRecord } from "@/repositories/editorTransactions";

// The fixed option lists for the content form, kept client-safe (no
// "server-only") since the add/edit sheet renders these as <Select> options.
// Same split as lib/campaigns.ts: the vocabulary lives next to the domain,
// not inside the component that happens to render it first.

export const CONTENT_FORMATS: ContentFormat[] = ["Reel", "Story", "Post", "Long-form"];

// In pipeline order, so a <Select> reads top to bottom the way the work
// actually moves. "Dropped" sits last because it is the exit, not a stage.
export const CONTENT_STATUSES: ContentStatus[] = [
  "Idea",
  "Scripting",
  "Filming",
  "Editing",
  "Ready",
  "Posted",
  "Dropped",
];

// Statuses at which the thing is actually shootable-and-done enough to go out
// on its day. Anything short of this with a day approaching is work that has
// not been started, which is the one warning a planner owes its reader.
const READY_STATUSES = new Set<ContentStatus>(["Ready", "Posted"]);

export function isProductionReady(status: ContentStatus): boolean {
  return READY_STATUSES.has(status);
}

// An untitled entry is still a real plan ("something on Friday"), so it gets a
// stand-in rather than being rejected by the form: same call campaignLabel
// makes for a deal with no name.
export function contentLabel(title: string): string {
  return title.trim() || "Untitled";
}

// Form-shaped input: the posting date as produced by <input type="date">
// ("yyyy-mm-dd"), converted to the storage format (DD/MM/YYYY) by the action
// before it reaches the writer. Distinct from NewContentItem in
// repositories/contentPlan.ts, which is already storage-shaped. Same split
// campaignRepository draws between CampaignFormValues and NewCampaignInput.
export interface ContentFormValues {
  title: string;
  format: ContentFormat;
  status: ContentStatus;
  postDate: string; // "yyyy-mm-dd", or "" for an idea with no day yet
  notes: string;
  editorTransactionId: string | null;
}

// A Server Action is reachable by direct POST rather than only through the
// form that calls it, so the two closed unions are checked at the boundary
// rather than trusted from the <Select> that produced them.
export function isContentFormat(value: string): value is ContentFormat {
  return (CONTENT_FORMATS as string[]).includes(value);
}

export function isContentStatus(value: string): value is ContentStatus {
  return (CONTENT_STATUSES as string[]).includes(value);
}

// --- Videos already sent to an editor --------------------------------------
// A flat option list for the content form's picker, never the stored records:
// the same discipline buildCampaignBrandOptions and buildInvoiceBrandOptions
// follow. Client-safe, since the <Select> that renders it is a client
// component.

export interface EditorVideoOption {
  /** The EditorTransaction id, stored on the entry as editorTransactionId. */
  id: string;
  /** The name the job was filed under, which becomes the entry's title. */
  video: string;
  editor: string;
  /** DD/MM/YYYY the cut came back. */
  deliveryDate: string;
  /**
   * Already linked to something: an entry on the plan, or a brand deal.
   * Shown rather than hidden, see below.
   */
  linked: boolean;
}

// A cancelled job was never edited, so there is nothing to post.
const CANCELLED = "cancelled";

/**
 * Every video that went to an editor, newest delivery first, with the ones
 * already spoken for marked and sorted last.
 *
 * Marked rather than filtered out, for two reasons: a record being edited has
 * to be able to show its own current link, which a filtered list could not
 * offer back; and "which of these have I already used" is exactly the
 * question the picker is there to answer, so hiding the answer would be odd.
 *
 * `linkedRecords` is typed on the one field it reads, so both stores that can
 * claim a job count toward the mark: an entry on the content plan and a brand
 * deal are the same claim on the same cut, and a picker that knew about only
 * one of them would offer a job as free that is not.
 */
export function buildEditorVideoOptions(
  transactions: EditorTransactionRecord[],
  linkedRecords: Pick<ContentItem, "editorTransactionId">[]
): EditorVideoOption[] {
  const claimed = new Set(
    linkedRecords
      .map((record) => record.editorTransactionId)
      .filter((id): id is string => id !== null)
  );

  return transactions
    .filter((txn) => txn.status.trim().toLowerCase() !== CANCELLED && txn.video.trim() !== "")
    .map((txn) => ({
      id: txn.id,
      video: txn.video.trim(),
      editor: txn.editor.trim(),
      deliveryDate: txn.deliveryDate,
      linked: claimed.has(txn.id),
    }))
    .sort((a, b) => {
      // Unclaimed first: those are the ones the picker exists to surface.
      if (a.linked !== b.linked) return a.linked ? 1 : -1;
      // Then newest delivery. parseSheetDate answers NaN for an unparsable
      // date, and a NaN comparison is always false, so those keep their
      // relative order at the end rather than shuffling.
      return parseSheetDate(b.deliveryDate) - parseSheetDate(a.deliveryDate);
    });
}
