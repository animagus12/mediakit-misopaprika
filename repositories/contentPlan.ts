// Content the creator makes for themselves: a reel, a story, a post that no
// brand is paying for. The other half of the content calendar, alongside the
// campaigns in ./campaigns.
//
// A separate store rather than a flag on CampaignRecord. A campaign is a
// commercial record with a brand, money, an invoice and a payment status, and
// none of that applies here; carrying a campaign row with every one of those
// fields blank, and teaching every earnings and brand projection to skip it,
// would corrupt the record that the rest of the app is built on. What the two
// share is a posting day, and that is joined at the calendar, not in storage.
//
// Types only, and deliberately no "server-only": the calendar's forms and
// rows are client components. Reading and writing lives in
// ./contentPlan.writer.server.

export type ContentFormat = "Reel" | "Story" | "Post" | "Long-form";

// The production pipeline, in order: an idea becomes a script, gets shot, cut,
// queued, and goes out. "Dropped" is the shelf, so an idea can be abandoned
// without being deleted, the same role "Cancelled" plays for a campaign.
//
// Unlike Campaign.status, this is a closed union rather than a free string.
// That field inherited an open vocabulary from a spreadsheet and has to keep
// accepting off-list values; this store is new and has no such history, so
// the compiler can be made to check it.
export type ContentStatus =
  | "Idea"
  | "Scripting"
  | "Filming"
  | "Editing"
  | "Ready"
  | "Posted"
  | "Dropped";

// Nothing further happens to these two, so they leave the planning views the
// way "Completed" and "Cancelled" take a campaign out of the active stage.
const PAST_STATUSES = new Set<ContentStatus>(["Posted", "Dropped"]);
export type ContentStage = "active" | "past";

export interface ContentItemRecord {
  id: string;
  title: string;
  format: ContentFormat;
  status: ContentStatus;
  /**
   * DD/MM/YYYY, the day it goes out, or "" while it is still just an idea.
   *
   * Named postDate rather than date because Campaign.date means the day the
   * deal was struck: the calendar reads both, and two fields called "date"
   * meaning different things is how the wrong one gets plotted.
   *
   * DD/MM/YYYY, not ISO, so every date helper in the app (lib/campaigns.ts,
   * lib/contentCalendar.ts) reads this store unchanged.
   */
  postDate: string;
  notes: string;
  /**
   * The EditorTransaction this was cut from, or null when it wasn't one.
   *
   * The title is stored separately and stays editable rather than being read
   * through this link: a plan entry is allowed to be called something other
   * than whatever the job was filed under. What the id buys is the answer to
   * "which of the videos I sent out are still not on the calendar", which is
   * a question a title match could not answer once either was edited.
   */
  editorTransactionId: string | null;
  /** ISO. The only clock an undated idea has: see UnscheduledPost.ageDays. */
  createdAt: string;
}

export interface ContentItem extends ContentItemRecord {
  stage: ContentStage; // derived from status, see PAST_STATUSES
}

export interface NewContentItem {
  title: string;
  format: ContentFormat;
  status: ContentStatus;
  postDate: string; // DD/MM/YYYY, "" for an idea with no day yet
  notes: string;
  editorTransactionId: string | null;
}

export interface ContentItemUpdate extends NewContentItem {
  id: string;
}

export function toContentItem(record: ContentItemRecord): ContentItem {
  return { ...record, stage: PAST_STATUSES.has(record.status) ? "past" : "active" };
}
