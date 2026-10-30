// What the payment ledger changes about a book written before it: the deals
// whose cash moves month, the invoice advances now counted as received, the
// invoices whose status or balance now reads differently, and the Scam deals
// no longer counted as money owed.
//
// Pure, so it can be run against a downloaded backup (scripts/ledger-report)
// without touching the store, and tested against fixtures.
import { isCampaignCalledOff, toIsoDate } from "@/lib/campaigns";
import { buildInvoiceNumber, computeBalanceDue, invoiceDueDates, withInvoiceDueDate } from "@/lib/invoice";
import { attachInvoiceSettlements, attachSettlements } from "@/lib/payments";
import { toCampaign, type Campaign, type CampaignRecord } from "@/repositories/campaigns";
import { toInvoice, type InvoiceRecord, type InvoiceStatus } from "@/repositories/invoices";
import type { PaymentRecord } from "@/repositories/payments";

export interface LedgerMonthMove {
  campaignId: string;
  brand: string;
  campaign: string;
  amount: number;
  /** "YYYY-MM" the deal was posted in, where its cash used to be filed. */
  from: string;
  /** "YYYY-MM" the money arrived in, where it is filed now. */
  to: string;
}

export interface LedgerAdvanceCounted {
  campaignId: string;
  renewalId: string | null;
  brand: string;
  campaign: string;
  invoiceNo: string;
  amount: number;
}

export interface LedgerInvoiceChange {
  invoiceId: string;
  invoiceNo: string;
  storedStatus: InvoiceStatus;
  status: InvoiceStatus;
  storedBalance: number;
  balance: number;
}

export interface LedgerScamPending {
  campaignId: string;
  brand: string;
  amount: number;
}

export interface LedgerMoveReport {
  movedMonths: LedgerMonthMove[];
  advancesCounted: LedgerAdvanceCounted[];
  invoiceChanges: LedgerInvoiceChange[];
  scamPending: LedgerScamPending[];
}

function postedMonth(campaign: Campaign): string | null {
  const day = toIsoDate(campaign.uploadDate) || toIsoDate(campaign.date);
  return day ? day.slice(0, 7) : null;
}

/** The deals, invoices and payments a backup holds, read the way the app reads them. */
export function readLedgerBook(records: CampaignRecord[], invoiceRecords: InvoiceRecord[], payments: PaymentRecord[]) {
  const dueDates = invoiceDueDates(invoiceRecords);
  const campaigns = attachSettlements(
    records.map((record) => withInvoiceDueDate(toCampaign(record), dueDates)),
    invoiceRecords,
    payments
  );
  const invoices = attachInvoiceSettlements(invoiceRecords.map(toInvoice), campaigns, payments);
  return { campaigns, invoices };
}

export function ledgerMoveReport(
  records: CampaignRecord[],
  invoiceRecords: InvoiceRecord[],
  payments: PaymentRecord[]
): LedgerMoveReport {
  const { campaigns, invoices } = readLedgerBook(records, invoiceRecords, payments);
  const invoiceNo = new Map(invoiceRecords.map((invoice) => [invoice.id, buildInvoiceNumber(invoice.invoiceNo)]));
  const report: LedgerMoveReport = { movedMonths: [], advancesCounted: [], invoiceChanges: [], scamPending: [] };

  for (const campaign of campaigns) {
    if (isCampaignCalledOff(campaign.status)) continue;

    if (campaign.type === "Scam" && campaign.storedPaymentStatus === "pending" && campaign.cash > 0) {
      report.scamPending.push({ campaignId: campaign.id, brand: campaign.brand, amount: campaign.cash });
    }

    const posted = postedMonth(campaign);
    for (const entry of campaign.settlement?.entries ?? []) {
      if (entry.legacyKind === "status" && entry.date && posted && entry.date.slice(0, 7) !== posted) {
        report.movedMonths.push({
          campaignId: campaign.id,
          brand: campaign.brand,
          campaign: campaign.campaign,
          amount: entry.gross,
          from: posted,
          to: entry.date.slice(0, 7),
        });
      }
      if (entry.legacyKind === "advance") {
        report.advancesCounted.push({
          campaignId: campaign.id,
          renewalId: null,
          brand: campaign.brand,
          campaign: campaign.campaign,
          invoiceNo: (campaign.invoiceId && invoiceNo.get(campaign.invoiceId)) || "",
          amount: entry.gross,
        });
      }
    }
    for (const renewal of campaign.usage.renewals) {
      for (const entry of renewal.settlement.entries) {
        if (entry.legacyKind !== "advance") continue;
        report.advancesCounted.push({
          campaignId: campaign.id,
          renewalId: renewal.id,
          brand: campaign.brand,
          campaign: campaign.campaign,
          invoiceNo: invoiceNo.get(renewal.invoiceId) ?? "",
          amount: entry.gross,
        });
      }
    }
  }

  for (const invoice of invoices) {
    const storedBalance = computeBalanceDue(invoice.subtotal, Number(invoice.advance) || 0);
    if (invoice.status === invoice.storedStatus && invoice.balanceDue === storedBalance) continue;
    report.invoiceChanges.push({
      invoiceId: invoice.id,
      invoiceNo: buildInvoiceNumber(invoice.invoiceNo),
      storedStatus: invoice.storedStatus,
      status: invoice.status,
      storedBalance,
      balance: invoice.balanceDue,
    });
  }

  return report;
}
