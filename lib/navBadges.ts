import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import type { Invoice } from "@/repositories/invoices";
import type { Brand } from "@/repositories/brands";
import type { Contact } from "@/repositories/contacts";
import type { EditorTransaction } from "@/repositories/editorTransactions";
import { isInvoiceOverdue, formatMoney } from "@/lib/invoice";
import { contactsForBrand } from "@/lib/contacts";
import { missingBrandDetails } from "@/lib/brands";
import {
  selectScheduledPosts,
  selectUnscheduledPosts,
  selectWeekAhead,
} from "@/lib/contentCalendar";
import { selectExpiringUsage, selectOwedRenewals } from "@/lib/usageRights";

// Live one-liners for the dashboard's nav-card grid: turns each link from a
// static menu entry into a "here's what's waiting for you there" pointer.
// Client-safe: takes already-fetched view models, keyed by nav href so the
// page can look each up while mapping navEntries. An entry with nothing worth
// flagging is simply absent from the map (no badge rendered).

export interface DashboardNavBadgesInput {
  campaigns: Campaign[];
  contentItems: ContentItem[];
  invoices: Invoice[];
  brands: Brand[];
  contacts: Contact[];
  editorTransactions: EditorTransaction[];
}

export function buildDashboardNavBadges(
  { campaigns, contentItems, invoices, brands, contacts, editorTransactions }: DashboardNavBadgesInput,
  now: Date = new Date()
): Record<string, string> {
  const badges: Record<string, string> = {};

  // Invoices: overdue is the sharper signal; fall back to issued-but-unpaid.
  const overdue = invoices.filter((invoice) => isInvoiceOverdue(invoice, now)).length;
  const awaitingPayment = invoices.filter((invoice) => invoice.status === "sent").length;
  if (overdue > 0) {
    badges["/invoices"] = `${overdue} overdue`;
  } else if (awaitingPayment > 0) {
    badges["/invoices"] = `${awaitingPayment} unpaid`;
  }

  // Brands with no photo and/or no reachable contact (their own or their
  // agency's): most commonly ones just auto-created from a new campaign.
  const needsDetails = brands.filter(
    (brand) => missingBrandDetails(brand, contactsForBrand(brand, contacts).length > 0) !== null
  ).length;
  if (needsDetails > 0) {
    badges["/brands"] = `${needsDetails} need${needsDetails === 1 ? "s" : ""} details`;
  }

  // Editor payouts still owed: the amount, not just the count, since this is
  // the only place the dashboard surfaces outgoing money at all.
  const pendingPayouts = editorTransactions.filter(
    (txn) => txn.status.trim().toLowerCase() === "pending"
  );
  if (pendingPayouts.length > 0) {
    const amount = pendingPayouts.reduce((sum, txn) => sum + (txn.amount ?? 0), 0);
    badges["/workspace"] = `${formatMoney(amount)} pending`;
  }

  // The calendar has three things worth flagging and room for one. They are
  // ranked by how little time is left to act: a post that was missed, then
  // this week's, then work that has no day at all.
  const weekAhead = selectWeekAhead(selectScheduledPosts(campaigns, contentItems, now));
  const overduePosts = weekAhead.filter((post) => post.state === "overdue").length;
  const unscheduled = selectUnscheduledPosts(campaigns, contentItems, now).length;
  if (overduePosts > 0) {
    badges["/calendar"] = `${overduePosts} not posted`;
  } else if (weekAhead.length > 0) {
    badges["/calendar"] = `${weekAhead.length} this week`;
  } else if (unscheduled > 0) {
    badges["/calendar"] = `${unscheduled} need${unscheduled === 1 ? "s" : ""} a date`;
  }

  // Campaigns: the only thing on that page with a deadline attached. An
  // expired licence outranks one still inside its window, and an uncollected
  // renewal fee is shown only when no licence needs deciding on, since a
  // decision is the thing that cannot be made later.
  const expiring = selectExpiringUsage(campaigns, now);
  const expired = expiring.filter((alert) => alert.term.state === "expired").length;
  const owedRenewals = selectOwedRenewals(campaigns, now).length;
  if (expired > 0) {
    badges["/campaigns"] = `${expired} usage expired`;
  } else if (expiring.length > 0) {
    badges["/campaigns"] = `${expiring.length} usage expiring`;
  } else if (owedRenewals > 0) {
    badges["/campaigns"] = `${owedRenewals} renewal${owedRenewals === 1 ? "" : "s"} unpaid`;
  }

  return badges;
}
