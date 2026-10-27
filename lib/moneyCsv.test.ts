import { describe, expect, it } from "vitest";
import type { OutflowRow } from "./expenses";
import { moneyEntries } from "./moneyBook";
import { moneyCsv, moneyCsvFilename } from "./moneyCsv";
import type { LedgerRow } from "./payments";

const payment: LedgerRow = {
  paymentId: "p1",
  target: { kind: "renewal", campaignId: "D1", renewalId: "R0002" },
  fy: 2026,
  date: "2026-10-10",
  bucketDate: "2026-10-10",
  brand: 'Blinkit, "Quick"',
  targetLabel: "Rakhi · usage renewal",
  deal: "Rakhi",
  gross: 10000,
  tds: 1000,
  fee: 18.5,
  net: 8981.5,
  receivedInto: "business",
  method: "UPI",
  reference: "UTR-1",
  origin: "legacy",
  source: "stored",
};

const expense: OutflowRow = {
  id: "e1",
  source: "expense",
  date: "2026-10-12",
  estimated: false,
  fy: 2026,
  amount: 1200,
  category: "props",
  description: "=HYPERLINK(\"x\")",
  editor: null,
  campaignId: null,
  dealLabel: null,
  paidBy: null,
  method: null,
  receiptUrl: "https://blob.example/r.pdf",
  note: "line one\nline two",
};

describe("moneyCsv", () => {
  const csv = moneyCsv(moneyEntries([payment], [], [expense]));
  const lines = csv.replace(/^﻿/, "").split("\r\n");

  it("starts with a byte-order mark and a header, one row per entry, CRLF line endings", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe(
      "Date,Financial year,Direction,Category,Description,Details,Amount,TDS,Charges,Cash in or out,Account,Method,Reference,Note,Receipt,Flags"
    );
    expect(lines.at(-1)).toBe("");
  });

  it("writes money in with its deductions and what landed, signed", () => {
    expect(lines.find((line) => line.startsWith("10/10/2026"))).toBe(
      '10/10/2026,FY 2026-27,In,Usage renewal,"Blinkit, ""Quick""",Rakhi · usage renewal,10000.00,1000.00,18.50,8981.50,Business funds,UPI,UTR-1,,,From earlier record'
    );
  });

  it("writes money out negative, keeps a formula as text, and quotes a note across lines", () => {
    expect(csv).toContain(
      `12/10/2026,FY 2026-27,Out,Props,"'=HYPERLINK(""x"")",,1200.00,0.00,0.00,-1200.00,Not recorded,,,"line one\nline two",https://blob.example/r.pdf,`
    );
  });
});

describe("moneyCsvFilename", () => {
  it("names the span and the direction", () => {
    expect(moneyCsvFilename(2026, "in")).toBe("payments-fy-2026-27-money-in.csv");
    expect(moneyCsvFilename(null, null)).toBe("payments-all-years.csv");
  });
});
