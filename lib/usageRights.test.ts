import { describe, expect, it } from "vitest";
import { makeCampaign, makeRenewal, makeUsage } from "@/lib/testing/fixtures";
import { toUsage, type StoredUsage } from "@/repositories/campaigns";
import { selectExpiringUsage, usageStartDateProblem, usageTerm } from "@/lib/usageRights";

// Noon IST on 18/11/2026, so the day is the same in every time zone the
// suite might run in.
const NOW = new Date("2026-11-18T06:30:00.000Z");

describe("usageTerm start", () => {
  it("waits with the whole term unspent until it is started, whatever the upload date", () => {
    const campaign = makeCampaign({
      uploadDate: "01/10/2026",
      usage: makeUsage({ days: 30, startedOn: "" }),
    });

    const term = usageTerm(campaign, NOW);

    expect(term.state).toBe("unstarted");
    expect(term.daysRemaining).toBe(30);
    expect(term.label).toBe("Not started, 30 days left");
    expect(term.endDate).toBe("");
  });

  it("counts from the day it was started, not the upload date", () => {
    const campaign = makeCampaign({
      uploadDate: "01/10/2026",
      usage: makeUsage({ days: 30, startedOn: "10/11/2026" }),
    });

    const term = usageTerm(campaign, NOW);

    expect(term.state).toBe("active");
    expect(term.startDayKey).toBe("2026-11-10");
    expect(term.endDate).toBe("10/12/2026");
    expect(term.daysRemaining).toBe(22);
  });

  it("reads an unstarted indefinite licence as not started, then as indefinite once started", () => {
    const waiting = makeCampaign({ usage: makeUsage({ indefinite: true, startedOn: "" }) });
    const running = makeCampaign({ usage: makeUsage({ indefinite: true, startedOn: "10/11/2026" }) });

    expect(usageTerm(waiting, NOW).label).toBe("Not started");
    expect(usageTerm(running, NOW).state).toBe("indefinite");
  });

  it("reads a licence ended before it ever started as ended", () => {
    const campaign = makeCampaign({
      usage: makeUsage({ days: 30, startedOn: "", status: "ended", endedOn: "15/11/2026" }),
    });

    expect(usageTerm(campaign, NOW).state).toBe("ended");
  });

  it("counts a renewal from its own start even when the base term never started", () => {
    const campaign = makeCampaign({
      usage: makeUsage({
        days: 30,
        startedOn: "",
        renewals: [makeRenewal({ startDate: "10/11/2026", days: 30 })],
      }),
    });

    expect(usageTerm(campaign, NOW).state).toBe("active");
  });

  it("keeps a licence that has not started off the dashboard's decision list", () => {
    const campaign = makeCampaign({ usage: makeUsage({ days: 1, startedOn: "" }) });

    expect(selectExpiringUsage([campaign], NOW)).toEqual([]);
  });
});

describe("toUsage startedOn", () => {
  // A licence written before startedOn existed: the field is absent outright.
  function legacy(overrides: Partial<StoredUsage>): StoredUsage {
    const { startedOn: _omitted, ...stored } = makeUsage(overrides);
    void _omitted;
    return stored;
  }

  it("carries a legacy licence with a term on from its upload date", () => {
    const usage = toUsage(legacy({ days: 30 }), { uploadDate: "01/10/2026", date: "01/09/2026" });
    expect(usage.startedOn).toBe("01/10/2026");
  });

  it("leaves a legacy licence on a post not yet up waiting to be started", () => {
    const usage = toUsage(legacy({ days: 30 }), { uploadDate: "", date: "01/09/2026" });
    expect(usage.startedOn).toBe("");
  });

  it("leaves a legacy deal with no term unstarted, so a term added later waits too", () => {
    const usage = toUsage(legacy({}), { uploadDate: "01/10/2026", date: "01/09/2026" });
    expect(usage.startedOn).toBe("");
  });

  it("keeps a stored empty start empty, whatever the upload date", () => {
    const usage = toUsage(makeUsage({ days: 30, startedOn: "" }), { uploadDate: "01/10/2026", date: "01/09/2026" });
    expect(usage.startedOn).toBe("");
  });
});

describe("usageStartDateProblem", () => {
  it("accepts today and earlier", () => {
    expect(usageStartDateProblem("2026-11-18", NOW)).toBeNull();
    expect(usageStartDateProblem("2026-10-01", NOW)).toBeNull();
  });

  it("refuses a future day and a malformed one", () => {
    expect(usageStartDateProblem("2026-11-19", NOW)).toBe("The start date can't be in the future");
    expect(usageStartDateProblem("18/11/2026", NOW)).toBe("Pick the day it started");
  });
});
