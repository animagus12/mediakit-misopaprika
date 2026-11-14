import { describe, expect, it } from "vitest";
import {
  negativeAmountProblem,
  paymentFormFrom,
  paymentInputFrom,
  savedPaymentTdsMode,
  withBankFee,
  withGross,
  withNet,
  withTds,
} from "./paymentForm";

const start = paymentFormFrom(
  {
    date: "2026-11-05",
    gross: 20000,
    tds: 2000,
    bankFee: 0,
    method: "UPI",
    reference: "",
    note: "",
  },
  "rate"
);

describe("payment form", () => {
  it("opens with net worked out from the amount, TDS and charges", () => {
    expect(start.net).toBe("18000");
  });

  it("re-estimates TDS from the expected rate until TDS is typed", () => {
    const changed = withGross(start, "30000", 10);
    expect(changed).toMatchObject({ tds: "3000", net: "27000" });

    const typed = withGross(withTds(start, "1500"), "30000", 10);
    expect(typed).toMatchObject({ tds: "1500", net: "28500" });
  });

  it("works TDS out from net received while TDS is the rate's estimate", () => {
    const fromNet = withNet(start, "19600", 10);
    expect(fromNet).toMatchObject({ tds: "400", bankFee: "0", net: "19600", tdsMode: "net" });
    expect(negativeAmountProblem(fromNet)).toBeNull();
  });

  it("keeps net received once typed, with TDS taking up later changes to the amount or charges", () => {
    const fromNet = withNet(start, "19600", 10);
    expect(withBankFee(fromNet, "100")).toMatchObject({ tds: "300", bankFee: "100", net: "19600" });
    expect(withGross(fromNet, "25000", 10)).toMatchObject({ tds: "5400", net: "19600" });
  });

  it("works the charges out from net received when there is no TDS rate or TDS was typed", () => {
    expect(withBankFee(start, "118").net).toBe("17882");
    expect(withNet(start, "17882", null)).toMatchObject({ tds: "2000", bankFee: "118" });
    expect(withNet(withTds(start, "2000"), "17882", 10)).toMatchObject({ tds: "2000", bankFee: "118" });
  });

  it("reopens a saved payment with TDS, or on a deal expecting some, to work TDS out from net", () => {
    expect(savedPaymentTdsMode(2000, null)).toBe("net");
    expect(savedPaymentTdsMode(0, 10)).toBe("net");
    expect(savedPaymentTdsMode(0, null)).toBe("typed");
    expect(savedPaymentTdsMode(0, 0)).toBe("typed");
  });

  it("flags a net typed above what the other amounts leave", () => {
    expect(negativeAmountProblem(withNet(start, "18500", null))).toMatch(/less TDS/);
    expect(negativeAmountProblem(withNet(start, "20500", 10))).toMatch(/less charges/);
  });

  it("rounds paise without float drift", () => {
    const form = withBankFee(withTds(withGross(start, "0.3", null), "0.1"), "0.1");
    expect(form.net).toBe("0.1");
  });

  it("builds the input the actions take, trimming text, dropping an unknown method, into the business account", () => {
    const input = paymentInputFrom(
      { ...start, reference: "  UTR 123 ", method: "" },
      "5f0c6f1e-2b7a-4c1d-9a3e-0000000000a1",
      { kind: "deal", campaignId: "D1" }
    );
    expect(input).toMatchObject({ gross: 20000, tds: 2000, bankFee: 0, reference: "UTR 123", method: null, receivedInto: "business" });
  });
});
