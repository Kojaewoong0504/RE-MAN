import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "@/lib/security/rate-limit";

describe("rate limit", () => {
  afterEach(() => {
    resetRateLimitsForTests();
  });

  it("allows requests within the configured window budget", () => {
    const first = checkRateLimit("try-on:user-1", {
      limit: 2,
      windowMs: 1000,
      now: 100
    });
    const second = checkRateLimit("try-on:user-1", {
      limit: 2,
      windowMs: 1000,
      now: 200
    });
    const third = checkRateLimit("try-on:user-1", {
      limit: 2,
      windowMs: 1000,
      now: 300
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
  });

  it("resets after the window expires", () => {
    checkRateLimit("try-on:user-2", {
      limit: 1,
      windowMs: 1000,
      now: 100
    });
    const blocked = checkRateLimit("try-on:user-2", {
      limit: 1,
      windowMs: 1000,
      now: 200
    });
    const reset = checkRateLimit("try-on:user-2", {
      limit: 1,
      windowMs: 1000,
      now: 1200
    });

    expect(blocked.ok).toBe(false);
    expect(reset.ok).toBe(true);
  });
});
