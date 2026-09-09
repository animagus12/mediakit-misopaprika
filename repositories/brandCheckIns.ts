// A pre-deal conversation, logged one outreach at a time.
//
// Its own store rather than a flag on BrandNote: a note is freeform prose the
// creator writes and deletes at will, while a check-in carries structured
// fields that decide whether a pursuit is still alive. Folding the two would
// mean a deleted note could silently reopen a closed pursuit.

export type CheckInChannel = "Email" | "Instagram DM" | "WhatsApp" | "Call" | "Other";

/**
 * Brands and agencies are both chased, and only brands carry a status, so the
 * subject is discriminated here rather than being a bare brandId. Adding the
 * discriminator later would mean migrating every record already in Redis,
 * which is why it is present from the first write.
 */
export type CheckInSubjectKind = "brand" | "agency";

export interface CheckIn {
  id: string;
  subjectKind: CheckInSubjectKind;
  subjectId: string;
  /** yyyy-mm-dd, backdatable: a DM sent on Tuesday is usually logged later. */
  date: string;
  channel: CheckInChannel;
  /** Whether this one got an answer: the field that resets the unanswered streak. */
  replied: boolean;
  /**
   * The window this message bought, when a date was promised ("we'll confirm
   * by the 15th"). null when nothing was, which is the common case.
   *
   * Held per check-in rather than per brand because the date is produced by
   * one conversation turn and moves with the next: a brand-level field goes
   * stale and has to be remembered and cleared by hand.
   */
  respondBy: string | null; // yyyy-mm-dd
  note: string;
  createdAt: string; // ISO datetime
}

export interface NewCheckIn {
  subjectKind: CheckInSubjectKind;
  subjectId: string;
  date: string;
  channel: CheckInChannel;
  respondBy: string | null;
  note: string;
}

/**
 * The two fields a logged check-in gains afterwards.
 *
 * Marking a reply, or recording a date the brand has since promised, is an
 * edit to the existing record and never a new one: a second record would
 * count as another unanswered attempt and close the pursuit a check-in early.
 */
export interface CheckInUpdate {
  id: string;
  replied: boolean;
  respondBy: string | null;
}
