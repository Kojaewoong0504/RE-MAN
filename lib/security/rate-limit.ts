type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __remanRateLimits: Map<string, RateLimitEntry> | undefined;
}

function getRateLimitStore() {
  if (!globalThis.__remanRateLimits) {
    globalThis.__remanRateLimits = new Map<string, RateLimitEntry>();
  }

  return globalThis.__remanRateLimits;
}

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number; now?: number }
): RateLimitResult {
  const now = options.now ?? Date.now();
  const store = getRateLimitStore();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      ok: true,
      remaining: Math.max(0, options.limit - 1),
      resetAt
    };
  }

  if (existing.count >= options.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt
    };
  }

  existing.count += 1;
  store.set(key, existing);

  return {
    ok: true,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt
  };
}

export function resetRateLimitsForTests() {
  getRateLimitStore().clear();
}
