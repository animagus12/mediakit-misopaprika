import { describe, expect, it } from "vitest";
import { loginRedirectPath } from "./loginRedirect";

describe("loginRedirectPath", () => {
  it("follows a path on this site", () => {
    expect(loginRedirectPath("/invoices")).toBe("/invoices");
    expect(loginRedirectPath("/brands/abc")).toBe("/brands/abc");
    expect(loginRedirectPath("/payments?fy=2026#due")).toBe("/payments?fy=2026#due");
  });

  it("goes to the dashboard when there is no page to go back to", () => {
    expect(loginRedirectPath(null)).toBe("/");
    expect(loginRedirectPath(undefined)).toBe("/");
    expect(loginRedirectPath("")).toBe("/");
    expect(loginRedirectPath("/")).toBe("/");
  });

  it("refuses every spelling of an outside address", () => {
    expect(loginRedirectPath("https://example.com")).toBe("/");
    expect(loginRedirectPath("//example.com")).toBe("/");
    expect(loginRedirectPath("/\\example.com")).toBe("/");
    expect(loginRedirectPath("/\t/example.com")).toBe("/");
    expect(loginRedirectPath("javascript:alert(1)")).toBe("/");
    expect(loginRedirectPath("example.com/invoices")).toBe("/");
  });

  it("does not send a signed-in person back to the login page", () => {
    expect(loginRedirectPath("/login")).toBe("/");
    expect(loginRedirectPath("/login?from=/invoices")).toBe("/");
  });
});
