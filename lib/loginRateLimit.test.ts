import { describe, expect, it } from "vitest";
import { createLoginRateLimiter, memoryAttemptStore, type AttemptStore } from "./loginRateLimit.server";

const WINDOW_MS = 15 * 60 * 1000;

function clock(start = 0) {
  let at = start;
  return { now: () => at, advance: (ms: number) => (at += ms) };
}

describe("memoryAttemptStore", () => {
  it("counts attempts per key and starts again once the window ends", async () => {
    const time = clock();
    const store = memoryAttemptStore(WINDOW_MS, time.now);
    expect(await store.hit("a")).toBe(1);
    expect(await store.hit("a")).toBe(2);
    expect(await store.hit("b")).toBe(1);
    time.advance(WINDOW_MS);
    expect(await store.hit("a")).toBe(1);
  });

  it("forgets a key that is cleared", async () => {
    const store = memoryAttemptStore(WINDOW_MS, clock().now);
    await store.hit("a");
    await store.hit("a");
    await store.clear("a");
    expect(await store.hit("a")).toBe(1);
  });
});

describe("createLoginRateLimiter", () => {
  it("refuses the attempt after the allowed number, a correct password included", async () => {
    const limiter = createLoginRateLimiter(null, memoryAttemptStore(WINDOW_MS, clock().now), 3);
    expect(await limiter.allow("ip")).toBe(true);
    expect(await limiter.allow("ip")).toBe(true);
    expect(await limiter.allow("ip")).toBe(true);
    expect(await limiter.allow("ip")).toBe(false);
  });

  it("never locks out someone who keeps signing in correctly", async () => {
    const limiter = createLoginRateLimiter(null, memoryAttemptStore(WINDOW_MS, clock().now), 3);
    for (let attempt = 0; attempt < 10; attempt++) {
      expect(await limiter.allow("ip")).toBe(true);
      await limiter.reset("ip");
    }
  });

  it("counts on this instance when the shared store fails", async () => {
    const failing: AttemptStore = {
      hit: () => Promise.reject(new Error("unreachable")),
      clear: () => Promise.reject(new Error("unreachable")),
    };
    const limiter = createLoginRateLimiter(failing, memoryAttemptStore(WINDOW_MS, clock().now), 1);
    const error = console.error;
    console.error = () => undefined;
    try {
      expect(await limiter.allow("ip")).toBe(true);
      expect(await limiter.allow("ip")).toBe(false);
      await expect(limiter.reset("ip")).resolves.toBeUndefined();
      expect(await limiter.allow("ip")).toBe(true);
    } finally {
      console.error = error;
    }
  });
});
