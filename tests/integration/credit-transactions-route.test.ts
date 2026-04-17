import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";
import {
  grantPaidCreditsForTests,
  reserveCredits,
  resetCreditsForTests
} from "@/lib/credits/server";

const authUser = {
  uid: "credit-transactions-user",
  email: "credit-transactions@example.com",
  name: "Credit Transactions User",
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

  return import("@/app/api/credits/transactions/route");
}

async function loadBalanceRouteWithCookies(cookieValues: Map<string, string>) {
  vi.resetModules();
  vi.doMock("next/headers", () => ({
    cookies: () => ({
      get: (name: string) => {
        const value = cookieValues.get(name);
        return value ? { value } : undefined;
      }
    })
  }));

  return import("@/app/api/credits/route");
}

async function buildAuthCookies() {
  const { issueSessionTokens } = await import("@/lib/auth/server");
  const { accessToken } = await issueSessionTokens(
    authUser,
    "credit-transactions-family",
    "credit-transactions-token"
  );

  return new Map([[SESSION_COOKIE_NAMES.access, accessToken]]);
}

describe("credit transactions API route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetCreditsForTests();
    process.env.AUTH_JWT_SECRET = "credit-transactions-test-secret";
  });

  it("requires a login session", async () => {
    const { GET } = await loadRouteWithCookies(new Map());
    const response = await GET(new Request("http://127.0.0.1:3001/api/credits/transactions"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "missing_access_token" });
  });

  it("returns newest credit transactions first with a bounded limit", async () => {
    grantPaidCreditsForTests(authUser.uid, 2);
    reserveCredits(authUser.uid, 1, {
      reason: "style_feedback",
      referenceId: "feedback-1"
    });

    const { GET } = await loadRouteWithCookies(await buildAuthCookies());
    const response = await GET(
      new Request("http://127.0.0.1:3001/api/credits/transactions?limit=2")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.transactions).toHaveLength(2);
    expect(body.transactions[0]).toMatchObject({
      type: "debit",
      delta: -1,
      reason: "style_feedback",
      reference_id: "feedback-1"
    });
    expect(body.transactions[1]).toMatchObject({
      type: "grant_paid",
      delta: 2,
      reason: "paid_credit_grant"
    });
  });

  it("returns balance only when the ledger audit is consistent", async () => {
    grantPaidCreditsForTests(authUser.uid, 2);
    reserveCredits(authUser.uid, 1, {
      reason: "style_feedback",
      referenceId: "feedback-1"
    });

    const { GET } = await loadBalanceRouteWithCookies(await buildAuthCookies());
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      balance: 4,
      event_credits: 2,
      paid_credits: 2,
      ledger_ok: true,
      ledger_transaction_count: 3,
      latest_transaction_id: expect.any(String)
    });
  });
});
