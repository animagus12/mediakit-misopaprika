import { describe, expect, it } from "vitest";
import mediakitSeed from "@/data/mediakit.json";
import linksSeed from "@/data/links.json";
import { campaignFiguresProblem } from "./campaigns";
import { isNavigable, isSafeLinkUrl } from "./links";
import { parseMediaKitData } from "./mediakit";
import { parseLinksData, type LinkItem } from "@/repositories/links";

describe("isSafeLinkUrl", () => {
  it("allows web, email and phone links, and paths on this site", () => {
    for (const url of ["https://instagram.com/x", "http://example.com", "mailto:a@b.co", "tel:+919999999999", "/mediakit"]) {
      expect(isSafeLinkUrl(url)).toBe(true);
    }
  });

  it("refuses scripts, other sites spelled as paths, and half-typed addresses", () => {
    for (const url of ["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,hi", "//example.com", "/\\example.com", "www.example.com", ""]) {
      expect(isSafeLinkUrl(url)).toBe(false);
    }
  });

  it("makes a card with an unsafe address a plain card", () => {
    const item = { url: "javascript:alert(1)" } as LinkItem;
    expect(isNavigable(item)).toBe(false);
    expect(isNavigable({ ...item, url: "https://example.com" })).toBe(true);
  });
});

describe("parseLinksData", () => {
  it("accepts the seed and keeps it as it is", () => {
    const page = parseLinksData(linksSeed);
    expect(page).not.toBeNull();
    expect(parseLinksData(page)).toEqual(page);
  });

  it("refuses what isn't a links page", () => {
    expect(parseLinksData(null)).toBeNull();
    expect(parseLinksData("page")).toBeNull();
    expect(parseLinksData({ sections: "nope" })).toBeNull();
    expect(parseLinksData({ sections: [{ id: "" }] })).toBeNull();
    expect(parseLinksData({ sections: [{ id: "s", items: [{ id: "i", kind: "popup" }] }] })).toBeNull();
    expect(parseLinksData({ sections: [{ id: "s", items: [{ id: "i", url: 42 }] }] })).toBeNull();
    expect(parseLinksData({ profile: { socials: [{ platform: "x" }] } })).toBeNull();
  });

  it("drops fields a links page doesn't have", () => {
    const page = parseLinksData({ sections: [{ id: "s", extra: true, items: [{ id: "i", extra: true }] }] });
    expect(page?.sections[0]).not.toHaveProperty("extra");
    expect(page?.sections[0].items[0]).not.toHaveProperty("extra");
  });
});

describe("parseMediaKitData", () => {
  it("accepts the seed and keeps it as it is", () => {
    const kit = parseMediaKitData(mediakitSeed);
    expect(kit).not.toBeNull();
    expect(parseMediaKitData(kit)).toEqual(kit);
  });

  it("refuses an incomplete media kit", () => {
    expect(parseMediaKitData(null)).toBeNull();
    expect(parseMediaKitData({})).toBeNull();
    expect(parseMediaKitData({ ...mediakitSeed, header: undefined })).toBeNull();
    expect(parseMediaKitData({ ...mediakitSeed, services: mediakitSeed.services.slice(0, 2) })).toBeNull();
    expect(parseMediaKitData({ ...mediakitSeed, header: { ...mediakitSeed.header, bio: 7 } })).toBeNull();
  });
});

describe("campaignFiguresProblem", () => {
  const figures = { amount: 5000, barterValue: 0, reels: 1, story: 1 };

  it("accepts a deal's figures", () => {
    expect(campaignFiguresProblem(figures)).toBeNull();
    expect(campaignFiguresProblem({ ...figures, usageFee: 1000, usageDays: 90 })).toBeNull();
  });

  it("refuses figures that aren't zero-or-more numbers", () => {
    expect(campaignFiguresProblem({ ...figures, amount: -1 })).not.toBeNull();
    expect(campaignFiguresProblem({ ...figures, amount: Number.NaN })).not.toBeNull();
    expect(campaignFiguresProblem({ ...figures, amount: "5000" as unknown as number })).not.toBeNull();
    expect(campaignFiguresProblem({ ...figures, barterValue: Infinity })).not.toBeNull();
    expect(campaignFiguresProblem({ ...figures, reels: 1.5 })).not.toBeNull();
    expect(campaignFiguresProblem({ ...figures, usageFee: -5 })).not.toBeNull();
    expect(campaignFiguresProblem({ ...figures, usageDays: -1 })).not.toBeNull();
  });
});
