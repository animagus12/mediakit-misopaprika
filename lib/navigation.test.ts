import { describe, expect, it } from "vitest";
import { currentNavTitle, currentNavTrail, isNavHrefActive, navEntries } from "@/lib/navigation";

describe("isNavHrefActive", () => {
  it("matches the dashboard only on itself", () => {
    expect(isNavHrefActive("/", "/")).toBe(true);
    expect(isNavHrefActive("/campaigns", "/")).toBe(false);
  });

  it("matches a section and its nested routes but not a longer sibling", () => {
    expect(isNavHrefActive("/invoices/new", "/invoices")).toBe(true);
    expect(isNavHrefActive("/links-editor", "/links")).toBe(false);
  });
});

describe("currentNavTitle", () => {
  it("names the dashboard Home", () => {
    expect(currentNavTitle("/")).toBe("Home");
  });

  it("names the account pages, which have no sidebar row", () => {
    expect(currentNavTitle("/trash")).toBe("Trash");
    expect(currentNavTitle("/backup")).toBe("Backup & restore");
  });

  it("names an editor after the public page it edits", () => {
    expect(currentNavTitle("/mediakit-generator")).toBe("Media kit");
    expect(currentNavTitle("/links-editor")).toBe("Links page");
  });

  it("is null off the map", () => {
    expect(currentNavTitle("/login")).toBeNull();
  });
});

describe("currentNavTrail", () => {
  it("is a plain title on a section's own page", () => {
    expect(currentNavTrail("/invoices")).toEqual({ parent: null, title: "Invoices" });
  });

  it("leads back to the section from a nested page", () => {
    expect(currentNavTrail("/invoices/new")).toEqual({
      parent: { href: "/invoices", title: "Invoices" },
      title: "New invoice",
    });
    expect(currentNavTrail("/invoices/abc123")?.title).toBe("Edit invoice");
    expect(currentNavTrail("/brands/abc123")).toEqual({
      parent: { href: "/brands", title: "Brands" },
      title: "Brand details",
    });
  });

  it("falls back to the section's title where nested pages have no name", () => {
    expect(currentNavTrail("/campaigns/anything")).toEqual({ parent: null, title: "Campaigns" });
  });
});

describe("navEntries", () => {
  it("gives every public page one row, its editor's, with a live link", () => {
    const live = navEntries.filter((entry) => entry.liveHref).map((entry) => entry.liveHref);
    expect(live.sort()).toEqual(["/links", "/mediakit"]);
    expect(navEntries.some((entry) => entry.href === "/links" || entry.href === "/mediakit")).toBe(false);
  });
});
