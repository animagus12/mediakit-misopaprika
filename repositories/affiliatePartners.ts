// The roster half of the affiliate model: the programs themselves, as
// opposed to the money they pay out (./affiliatePayouts).
//
// Same split, and for the same reasons, as editors/editorTransactions: a
// partner is a standing relationship that is edited in place, a payout is an
// immutable-ish event filed against one. Types only, and deliberately no
// "server-only": the forms and tables that render these are client
// components, and reading/writing lives in ./affiliatePartners.writer.server.

// How the brand works out what is owed. "percent" takes commissionRate as a
// percentage of gross sales; "flat" takes it as rupees per sale. Stored
// rather than inferred so a payout entered by hand can be checked against
// what the program actually promised, see expectedCommission().
export type CommissionModel = "percent" | "flat";

export const COMMISSION_MODELS: CommissionModel[] = ["percent", "flat"];

// Whether the code is live. A paused program still has history worth keeping
// and a code that may come back, so it is a status rather than a deletion:
// the same reasoning as BrandStatus's "Dormant".
export type AffiliateStatus = "active" | "paused" | "ended";

export const AFFILIATE_STATUSES: AffiliateStatus[] = ["active", "paused", "ended"];

// How often the brand settles. Drives the expected-arrival date that the
// dashboard chases a late payout with, see lib/affiliates.
export type PayoutSchedule = "monthly" | "quarterly" | "on-request";

export const PAYOUT_SCHEDULES: PayoutSchedule[] = ["monthly", "quarterly", "on-request"];

export interface AffiliatePartner {
  id: string;
  /**
   * → Brand, so a program run by a brand already in the CRM shows its payouts
   * on that brand's page. null when the brand was never added: the program is
   * still worth tracking, so this never blocks creating one.
   */
  brandId: string | null;
  /** Display name, used when brandId is null or the CRM record is gone. */
  name: string;
  /** The creator code itself, e.g. "PAPRIKA10". */
  code: string;
  trackingUrl: string;
  commissionModel: CommissionModel;
  /** Percent when commissionModel is "percent", rupees per sale when "flat". */
  commissionRate: number;
  status: AffiliateStatus;
  startDate: string; // DD/MM/YYYY, as everywhere else in the app
  /** The brand's own affiliate portal, where the figures are read from. */
  dashboardUrl: string;
  payoutSchedule: PayoutSchedule;
  /**
   * → LinkItem.id on the /links page, joining the program to the card that
   * carries its code.
   *
   * This is the field that earns the whole model. linkStats counts clicks per
   * item id, so joining here gives conversion: clicks the brand's dashboard
   * cannot see, against sales only the brand's dashboard knows. Neither side
   * can produce that number alone. null when the code isn't on the links page.
   */
  linkItemId: string | null;
}

export interface NewAffiliatePartner {
  brandId: string | null;
  name: string;
  code: string;
  trackingUrl: string;
  commissionModel: CommissionModel;
  commissionRate: number;
  status: AffiliateStatus;
  startDate: string; // "yyyy-mm-dd", as produced by <input type="date">
  dashboardUrl: string;
  payoutSchedule: PayoutSchedule;
  linkItemId: string | null;
}

export interface AffiliatePartnerUpdate extends NewAffiliatePartner {
  id: string;
}
