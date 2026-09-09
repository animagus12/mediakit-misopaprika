// The money half of the affiliate model: one settlement period against one
// partner (./affiliatePartners), entered by hand from the brand's own portal
// exactly the way an editor transaction is entered.
//
// Types only, no "server-only": reading and writing live in
// ./affiliatePayouts.writer.server.

// Deliberately the same vocabulary as Campaign.paymentStatus rather than a
// third spelling of the same idea: earnings counts a payout with the same
// rules it counts a deal, so the two have to agree on what "received" means.
export type PayoutPaymentStatus = "pending" | "received";

export const PAYOUT_PAYMENT_STATUSES: PayoutPaymentStatus[] = ["pending", "received"];

export interface AffiliatePayout {
  id: string;
  partnerId: string; // → AffiliatePartner
  periodStart: string; // DD/MM/YYYY
  periodEnd: string; // DD/MM/YYYY
  /** Gross sales the brand attributed to the code in this period. */
  grossSales: number;
  /** How many orders that was: the numerator of the conversion read. */
  salesCount: number;
  /**
   * What the creator actually earns, as the brand reported it. Stored rather
   * than derived from grossSales x commissionRate: brands deduct returns,
   * cap categories and round in their own favour, so the computed figure is
   * a check on this one (see expectedCommission) and never a replacement.
   */
  commissionAmount: number;
  paymentStatus: PayoutPaymentStatus;
  /** DD/MM/YYYY, or "" while unpaid. */
  paidDate: string;
  paymentMethod: string;
}

export interface NewAffiliatePayout {
  partnerId: string;
  periodStart: string; // "yyyy-mm-dd", as produced by <input type="date">
  periodEnd: string;
  grossSales: number;
  salesCount: number;
  commissionAmount: number;
  paymentStatus: PayoutPaymentStatus;
  paidDate: string;
  paymentMethod: string;
}

export interface AffiliatePayoutUpdate extends NewAffiliatePayout {
  id: string;
}
