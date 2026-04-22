import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";
import { getCreditTransactions, resetCreditsForTests } from "@/lib/credits/server";

const authUser = {
  uid: "dev-credit-grant-user",
  email: "dev-credit-grant@example.com",
  name: "Dev Credit Grant User",
  picture: null,
  provider: "google" as const
};

async function loadRouteWithCookies(cookieValues: Map<string, string>) {
  vi.resetModules();
  vi.doMock("next/headers", () => ({
    cookies: () => ({
      get: (name: string) => {
        const value = cookieValues.get(name);
        return value ? { value } : undefined;
      }
    })
  }));

  return import("@/app/api/dev/credits/grant/route");
}

async function buildAuthCookies() {
  const { issueSessionTokens } = await import("@/lib/auth/server");
  const { accessToken } = await issueSessionTokens(
    authUser,
    "dev-credit-grant-family",
    "dev-credit-grant-token"
  );

  return new Map([[SESSION_COOKIE_NAMES.access, accessToken]]);
}

describe("POST /api/dev/credits/grant", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetCreditsForTests();
    vi.stubEnv("AUTH_JWT_SECRET", "dev-credit-grant-secret");
    vi.stubEnv("NODE_ENV", "development");
  });

  it("requires a login session", async () => {
    const { POST } = await loadRouteWithCookies(new Map());
    const response = await POST();

    expect(response.status).toBe(401);
  });

  it("grants local development credits to the signed in user", async () => {
    const { POST } = await loadRouteWithCookies(await buildAuthCookies());
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      granted: 10,
      balance: 13,
      paid_credits: 10,
      event_credits: 3
    });
    expect(getCreditTransactions(authUser.uid)[0]).toMatchObject({
      type: "grant_paid",
      delta: 10,
      reason: "paid_credit_grant",
      balance_after: 13
    });
  });

  it("is disabled in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { POST } = await loadRouteWithCookies(await buildAuthCookies());
    const response = await POST();

    expect(response.status).toBe(404);
  });
});
