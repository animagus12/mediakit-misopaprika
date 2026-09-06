import type { Invoice } from "@/repositories/invoices";
import type { Brand } from "@/repositories/brands";
import type { Contact } from "@/repositories/contacts";
import type { EditorTransaction } from "@/repositories/editorTransactions";
import { isInvoiceOverdue, formatMoney } from "@/lib/invoice";
import { contactsForBrand } from "@/lib/contacts";
import { missingBrandDetails } from "@/lib/brands";

// Live one-liners for the dashboard's nav-card grid: turns each link from a
// static menu entry into a "here's what's waiting for you there" pointer.
// Client-safe: takes already-fetched view models, keyed by nav href so the
// page can look each up while mapping navEntries. An entry with nothing worth
// flagging is simply absent from the map (no badge rendered).

export interface DashboardNavBadgesInput {
  invoices: Invoice[];
  brands: Brand[];
  contacts: Contact[];
  editorTransactions: EditorTransaction[];
}

export function buildDashboardNavBadges(
  { invoices, brands, contacts, editorTransactions }: DashboardNavBadgesInput,
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

  return badges;
}
