import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";
import {
  getCreditTransactions,
  resetCreditsForTests
} from "@/lib/credits/server";

const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
const authUser = {
  uid: "closet-analyze-user",
  email: "closet-analyze@example.com",
  name: "Closet Analyze User",
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

  return import("@/app/api/closet/analyze/route");
}

async function buildAuthCookies() {
  const { issueSessionTokens } = await import("@/lib/auth/server");
  const { accessToken } = await issueSessionTokens(
    authUser,
    "closet-analyze-family",
    "closet-analyze-token"
  );

  return new Map([[SESSION_COOKIE_NAMES.access, accessToken]]);
}

function buildRequest(payload: unknown, headers?: HeadersInit) {
  return new Request("http://127.0.0.1:3001/api/closet/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {})
    },
    body: JSON.stringify(payload)
  });
}

describe("POST /api/closet/analyze", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetCreditsForTests();
    process.env.AUTH_JWT_SECRET = "closet-analyze-test-secret";
    process.env.CLOSET_ANALYSIS_PROVIDER = "mock";
  });

  it("requires a login session", async () => {
    const { POST } = await loadRouteWithCookies(new Map());
    const response = await POST(buildRequest({ image }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "missing_access_token" });
  });

  it("returns mock closet analysis draft", async () => {
    const { POST } = await loadRouteWithCookies(await buildAuthCookies());
    const response = await POST(buildRequest({ image }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      size: "",
      size_source: "unknown",
      credits_charged: 1,
      credits_remaining: 2,
      subscription_active: false
    });
    expect(body.category).toBeTruthy();
    expect(getCreditTransactions(authUser.uid)[0]).toMatchObject({
      type: "debit",
      delta: -1,
      reason: "closet_analysis",
      balance_after: 2
    });
  });

  it("does not charge twice when the same closet analysis request is replayed", async () => {
    const { POST } = await loadRouteWithCookies(await buildAuthCookies());
    const headers = { "Idempotency-Key": "closet-image-1" };

    const first = await POST(buildRequest({ image }, headers));
    const firstBody = await first.json();
    const second = await POST(buildRequest({ image }, headers));
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody).toMatchObject({
      credits_charged: 1,
      credits_remaining: 2,
      idempotent_replay: false
    });
    expect(secondBody).toMatchObject({
      credits_charged: 0,
      credits_remaining: 2,
      idempotent_replay: true,
      credit_reference_id: firstBody.credit_reference_id
    });
    expect(
      getCreditTransactions(authUser.uid).filter((transaction) => transaction.type === "debit")
    ).toHaveLength(1);
  });

  it("charges only once across a batch session even when multiple draft ids are analyzed", async () => {
    const { POST } = await loadRouteWithCookies(await buildAuthCookies());
    const first = await POST(
      buildRequest(
        { image, batch_session_id: "batch-session-1", draft_id: "draft-top" },
        { "Idempotency-Key": "closet-analyze:batch-session-1" }
      )
    );
    const firstBody = await first.json();
    const second = await POST(
      buildRequest(
        { image, batch_session_id: "batch-session-1", draft_id: "draft-bottom" },
        { "Idempotency-Key": "closet-analyze:batch-session-1" }
      )
    );
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody).toMatchObject({
      credits_charged: 1,
      credits_remaining: 2,
      idempotent_replay: false
    });
    expect(secondBody).toMatchObject({
      credits_charged: 0,
      credits_remaining: 2,
      idempotent_replay: true,
      credit_reference_id: firstBody.credit_reference_id
    });
    expect(
      getCreditTransactions(authUser.uid).filter((transaction) => transaction.type === "debit")
    ).toHaveLength(1);
  });

  it("refunds the reserved credit when closet analysis fails", async () => {
    process.env.CLOSET_ANALYSIS_PROVIDER = "gemini";
    const { POST } = await loadRouteWithCookies(await buildAuthCookies());
    const response = await POST(buildRequest({ image }, { "Idempotency-Key": "failed-closet" }));

    expect(response.status).toBe(502);
    expect(getCreditTransactions(authUser.uid)[0]).toMatchObject({
      type: "refund",
      delta: 1,
      reason: "closet_analysis_failed_refund"
    });
    expect(getCreditTransactions(authUser.uid)[1]).toMatchObject({
      type: "debit",
      delta: -1,
      reason: "closet_analysis"
    });
  });

  it("rejects missing image", async () => {
    const { POST } = await loadRouteWithCookies(await buildAuthCookies());
    const response = await POST(buildRequest({}));

    expect(response.status).toBe(400);
  });
});
