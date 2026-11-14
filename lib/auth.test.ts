import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, verifyPassword, verifySessionToken } from "./auth";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-session-secret");
  vi.stubEnv("APP_PASSWORD", "correct horse");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("session tokens", () => {
  it("accepts a token it made, until it expires", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const token = await createSessionToken(60_000);
    expect(await verifySessionToken(token)).toBe(true);
    vi.setSystemTime(1_000_000 + 60_001);
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("refuses a token whose expiry was edited", async () => {
    const token = await createSessionToken(60_000);
    const [expiry, signature] = token.split(".");
    expect(await verifySessionToken(`${Number(expiry) + 1}.${signature}`)).toBe(false);
  });

  it("refuses every existing token once the password changes", async () => {
    const token = await createSessionToken(60_000);
    vi.stubEnv("APP_PASSWORD", "a new password");
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("refuses every token while no password is set", async () => {
    const token = await createSessionToken(60_000);
    vi.stubEnv("APP_PASSWORD", "");
    expect(await verifySessionToken(token)).toBe(false);
    await expect(createSessionToken(60_000)).rejects.toThrow("APP_PASSWORD");
  });

  it("refuses a missing or malformed token", async () => {
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("")).toBe(false);
    expect(await verifySessionToken("not-a-token")).toBe(false);
  });
});

describe("verifyPassword", () => {
  it("accepts only the configured password", async () => {
    expect(await verifyPassword("correct horse")).toBe(true);
    expect(await verifyPassword("correct hors")).toBe(false);
    expect(await verifyPassword("")).toBe(false);
  });

  it("refuses everything while no password is set", async () => {
    vi.stubEnv("APP_PASSWORD", "");
    expect(await verifyPassword("")).toBe(false);
  });
});
