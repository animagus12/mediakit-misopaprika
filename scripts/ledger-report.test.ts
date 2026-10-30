// What the payment ledger changes about a real book, read from a backup file.
//
//   LEDGER_BACKUP=path/to/backup.json npm run ledger:report
//
// (PowerShell: $env:LEDGER_BACKUP="path\to\backup.json"; npm run ledger:report)
//
// Download the backup from Backup & restore first. The file is only read: the
// store is never touched, and nothing runs unless LEDGER_BACKUP is set.
import { readFileSync } from "node:fs";
import { describe, it, vi } from "vitest";
import { formatMoney } from "@/lib/invoice";
import { ledgerMoveReport, readLedgerBook } from "@/lib/ledgerReport";
import { summarizeEarnings } from "@/repositories/earnings";
import type { CampaignRecord } from "@/repositories/campaigns";
import type { InvoiceRecord } from "@/repositories/invoices";
import { toPaymentRecord, type PaymentRecord } from "@/repositories/payments";

vi.mock("@/repositories/campaigns.writer.server", () => ({
  getCampaigns: () => {
    throw new Error("the report reads the backup file, never the store");
  },
}));
vi.mock("@/repositories/affiliatePartners.writer.server", () => ({ getAffiliatePartners: () => [] }));
vi.mock("@/repositories/affiliatePayouts.writer.server", () => ({ getAffiliatePayouts: () => [] }));

const path = process.env.LEDGER_BACKUP;

function arrayOf<T>(records: Record<string, unknown>, key: string): T[] {
  const value = records[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

describe.skipIf(!path)("ledger report", () => {
  it("prints what the ledger changes", () => {
    const backup = JSON.parse(readFileSync(path as string, "utf8")) as { records?: Record<string, unknown> };
    const records = backup.records ?? {};
    const campaigns = arrayOf<CampaignRecord>(records, "campaigns");
    const invoices = arrayOf<InvoiceRecord>(records, "invoices");
    const payments = arrayOf<unknown>(records, "payments")
      .map(toPaymentRecord)
      .filter((payment): payment is PaymentRecord => payment !== null);

    const report = ledgerMoveReport(campaigns, invoices, payments);
    const earnings = summarizeEarnings(readLedgerBook(campaigns, invoices, payments).campaigns);
    const lines: string[] = [
      `Deals ${campaigns.length}, invoices ${invoices.length}, recorded payments ${payments.length}`,
      `Received ${formatMoney(earnings.paid)} (TDS ${formatMoney(earnings.tds)}, charges ${formatMoney(earnings.fees)}, net ${formatMoney(earnings.net)}), pending ${formatMoney(earnings.pending)}`,
      "",
      `Cash filed in the month it arrived (${report.movedMonths.length}):`,
      ...report.movedMonths.map((move) => `  ${move.brand} / ${move.campaign}: ${formatMoney(move.amount)} ${move.from} -> ${move.to}`),
      `Invoice advances now counted as received (${report.advancesCounted.length}):`,
      ...report.advancesCounted.map(
        (advance) =>
          `  ${advance.brand} / ${advance.campaign}${advance.renewalId ? " (renewal)" : ""}: ${formatMoney(advance.amount)} on ${advance.invoiceNo || "an invoice"}`
      ),
      `Invoices that now read differently (${report.invoiceChanges.length}):`,
      ...report.invoiceChanges.map(
        (change) =>
          `  ${change.invoiceNo}: ${change.storedStatus} ${formatMoney(change.storedBalance)} -> ${change.status} ${formatMoney(change.balance)}`
      ),
      `Scam deals no longer counted as pending (${report.scamPending.length}):`,
      ...report.scamPending.map((scam) => `  ${scam.brand}: ${formatMoney(scam.amount)}`),
    ];
    // Straight to stdout: vitest holds back console output from passing tests.
    process.stdout.write(`${lines.join("\n")}\n`);
  });
});
