import { describe, expect, it } from "vitest";
import { makeCampaignRecord, makeInvoiceRecord, makePaymentRecord } from "@/lib/testing/fixtures";
import { ledgerMoveReport } from "./ledgerReport";

describe("ledgerMoveReport", () => {
  it("lists a received deal whose paid month differs from its posting month", () => {
    const report = ledgerMoveReport(
      [
        makeCampaignRecord({ id: "A", amount: 25000, paymentStatus: "received", uploadDate: "14/08/2026", paidDate: "02/09/2026" }),
        makeCampaignRecord({ id: "B", amount: 5000, paymentStatus: "received", uploadDate: "14/08/2026", paidDate: "20/08/2026" }),
        makeCampaignRecord({ id: "C", amount: 5000, paymentStatus: "received", uploadDate: "14/08/2026", paidDate: "" }),
      ],
      [],
      []
    );

    expect(report.movedMonths).toEqual([
      { campaignId: "A", brand: "Acme", campaign: "Launch", amount: 25000, from: "2026-08", to: "2026-09" },
    ]);
  });

  it("lists invoice advances now counted as received, and the invoices that read differently", () => {
    const report = ledgerMoveReport(
      [
        makeCampaignRecord({ id: "A", amount: 60000, paymentStatus: "pending", invoiceId: "inv", invoiceRef: "MSP-INV-0009" }),
        makeCampaignRecord({ id: "B", amount: 9000, paymentStatus: "pending", invoiceId: "inv-lp", invoiceRef: "MSP-INV-0011" }),
      ],
      [
        makeInvoiceRecord({ id: "inv", invoiceNo: "0009", status: "sent", advance: 20000, items: [{ desc: "Reel", sub: "", qty: 1, price: 60000 }] }),
        makeInvoiceRecord({ id: "inv-lp", invoiceNo: "0011", status: "paid", items: [{ desc: "Reel", sub: "", qty: 1, price: 9000 }] }),
      ],
      []
    );

    expect(report.advancesCounted).toEqual([
      { campaignId: "A", renewalId: null, brand: "Acme", campaign: "Launch", invoiceNo: "MSP-INV-0009", amount: 20000 },
    ]);
    expect(report.invoiceChanges).toEqual([
      { invoiceId: "inv-lp", invoiceNo: "MSP-INV-0011", storedStatus: "paid", status: "sent", storedBalance: 9000, balance: 9000 },
    ]);
  });

  it("lists pending Scam deals and ignores deals with recorded payments", () => {
    const report = ledgerMoveReport(
      [
        makeCampaignRecord({ id: "S", type: "Scam", amount: 4000, paymentStatus: "pending" }),
        makeCampaignRecord({ id: "P", amount: 5000, paymentStatus: "received", uploadDate: "14/08/2026", paidDate: "02/09/2026" }),
      ],
      [],
      [makePaymentRecord({ id: "p1", target: { kind: "deal", campaignId: "P" }, date: "2026-09-02", gross: 5000 })]
    );

    expect(report.scamPending).toEqual([{ campaignId: "S", brand: "Acme", amount: 4000 }]);
    expect(report.movedMonths).toEqual([]);
  });
});
