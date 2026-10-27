import { describe, expect, it } from "vitest";
import {
  hasNegativeCharges,
  paymentFormFrom,
  paymentInputFrom,
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
    receivedInto: "ritika",
    method: "UPI",
    reference: "",
    note: "",
  },
  false
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

  it("recomputes net when the charges change, and the charges when net is typed", () => {
    expect(withBankFee(start, "118").net).toBe("17882");
    const fromNet = withNet(start, "17882");
    expect(fromNet.bankFee).toBe("118");
    expect(hasNegativeCharges(fromNet)).toBe(false);
  });

  it("flags a net typed above what the amount and TDS leave", () => {
    expect(hasNegativeCharges(withNet(start, "18500"))).toBe(true);
  });

  it("rounds paise without float drift", () => {
    const form = withBankFee(withTds(withGross(start, "0.3", null), "0.1"), "0.1");
    expect(form.net).toBe("0.1");
  });

  it("builds the input the actions take, trimming text and dropping an unknown method", () => {
    const input = paymentInputFrom(
      { ...start, reference: "  UTR 123 ", method: "" },
      "5f0c6f1e-2b7a-4c1d-9a3e-0000000000a1",
      { kind: "deal", campaignId: "D1" }
    );
    expect(input).toMatchObject({ gross: 20000, tds: 2000, bankFee: 0, reference: "UTR 123", method: null, receivedInto: "ritika" });
  });
});
