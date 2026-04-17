import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";
import {
  getCreditBalance,
  getCreditTransactions,
  resetCreditsForTests
} from "@/lib/credits/server";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";

const validTryOnPayload = {
  person_image: "data:image/png;base64,abc123",
  product_image: "data:image/png;base64,abc123",
  prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
};

const authUser = {
  uid: "try-on-route-user",
  email: "try-on-route@example.com",
  name: "Try On Route User",
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

  return import("@/app/api/try-on/route");
}

function buildRequest(payload: unknown, headers?: HeadersInit) {
  return new Request("http://127.0.0.1:3001/api/try-on", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {})
    },
    body: JSON.stringify(payload)
  });
}

describe("try-on API route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetCreditsForTests();
    resetRateLimitsForTests();
    process.env.AUTH_JWT_SECRET = "try-on-route-test-secret";
  });

  it("returns 401 when an authenticated generation request has no access token", async () => {
    const { POST } = await loadRouteWithCookies(new Map());
    const response = await POST(buildRequest(validTryOnPayload));

    await expect(response.json()).resolves.toMatchObject({
      error: "missing_access_token"
    });
    expect(response.status).toBe(401);
  });

  it("returns safe setup copy instead of leaking missing Vertex config details", async () => {
    const { issueSessionTokens } = await import("@/lib/auth/server");
    const { accessToken } = await issueSessionTokens(
      authUser,
      "try-on-route-family",
      "try-on-route-token"
    );
    const cookies = new Map([[SESSION_COOKIE_NAMES.access, accessToken]]);

    vi.stubEnv("TRY_ON_PROVIDER", "vertex");
    vi.stubEnv("VERTEX_PROJECT_ID", "");
    vi.stubEnv("VERTEX_LOCATION", "");
    vi.stubEnv("VERTEX_ACCESS_TOKEN", "");

    const { POST } = await loadRouteWithCookies(cookies);
    const response = await POST(buildRequest(validTryOnPayload));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      error: "missing_vertex_config",
      message: "실제 실착 생성 설정이 아직 준비되지 않았습니다. 지금은 레퍼런스 이미지를 확인해 주세요."
    });
    expect(JSON.stringify(body)).not.toContain("missing_vertex_try_on_config");
  });

  it("returns a generic safe message for upstream Vertex failures", async () => {
    const { issueSessionTokens } = await import("@/lib/auth/server");
    const { accessToken } = await issueSessionTokens(
      authUser,
      "try-on-route-family-2",
      "try-on-route-token-2"
    );
    const cookies = new Map([[SESSION_COOKIE_NAMES.access, accessToken]]);

    vi.stubEnv("TRY_ON_PROVIDER", "vertex");
    vi.stubEnv("VERTEX_PROJECT_ID", "project-1");
    vi.stubEnv("VERTEX_LOCATION", "us-central1");
    vi.stubEnv("VERTEX_ACCESS_TOKEN", "access-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "upstream secret details"
      })
    );

    const { POST } = await loadRouteWithCookies(cookies);
    const response = await POST(buildRequest(validTryOnPayload));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      error: "vertex_http_error",
      message: "실착 미리보기를 만들지 못했습니다. 레퍼런스 이미지를 먼저 확인하고 잠시 후 다시 시도해 주세요."
    });
    expect(JSON.stringify(body)).not.toContain("upstream secret details");
    expect(getCreditBalance(authUser.uid).balance).toBe(3);
    expect(getCreditTransactions(authUser.uid).map((transaction) => transaction.type)).toEqual([
      "refund",
      "debit",
      "grant_event"
    ]);
    expect(getCreditTransactions(authUser.uid)[0]).toMatchObject({
      reason: "try_on_failed_refund",
      reference_id: getCreditTransactions(authUser.uid)[1]?.reference_id
    });
  });

  it("charges one credit only after successful Vertex generation", async () => {
    const { issueSessionTokens } = await import("@/lib/auth/server");
    const { accessToken } = await issueSessionTokens(
      authUser,
      "try-on-route-family-3",
      "try-on-route-token-3"
    );
    const cookies = new Map([[SESSION_COOKIE_NAMES.access, accessToken]]);

    vi.stubEnv("TRY_ON_PROVIDER", "vertex");
    vi.stubEnv("VERTEX_PROJECT_ID", "project-1");
    vi.stubEnv("VERTEX_LOCATION", "us-central1");
    vi.stubEnv("VERTEX_ACCESS_TOKEN", "access-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          predictions: [
            {
              bytesBase64Encoded: "generated-image"
            }
          ]
        })
      })
    );

    const { POST } = await loadRouteWithCookies(cookies);
    const response = await POST(buildRequest(validTryOnPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "vertex",
      preview_image: "data:image/png;base64,generated-image",
      credits_charged: 1,
      credits_remaining: 2,
      credit_reference_id: expect.any(String)
    });
    expect(getCreditBalance(authUser.uid).balance).toBe(2);
    expect(getCreditTransactions(authUser.uid)[0]).toMatchObject({
      type: "debit",
      delta: -1,
      reason: "try_on_generation",
      reference_id: body.credit_reference_id,
      balance_after: 2
    });
  });

  it("does not charge twice when a successful Vertex request is replayed", async () => {
    const user = {
      ...authUser,
      uid: "try-on-idempotent-user"
    };
    const { issueSessionTokens } = await import("@/lib/auth/server");
    const { accessToken } = await issueSessionTokens(
      user,
      "try-on-route-family-4",
      "try-on-route-token-4"
    );
    const cookies = new Map([[SESSION_COOKIE_NAMES.access, accessToken]]);
    const headers = { "Idempotency-Key": "try-on-request-1" };

    vi.stubEnv("TRY_ON_PROVIDER", "vertex");
    vi.stubEnv("VERTEX_PROJECT_ID", "project-1");
    vi.stubEnv("VERTEX_LOCATION", "us-central1");
    vi.stubEnv("VERTEX_ACCESS_TOKEN", "access-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          predictions: [
            {
              bytesBase64Encoded: "generated-image"
            }
          ]
        })
      })
    );

    const { POST } = await loadRouteWithCookies(cookies);
    const first = await POST(buildRequest(validTryOnPayload, headers));
    const firstBody = await first.json();
    const second = await POST(buildRequest(validTryOnPayload, headers));
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
    expect(getCreditTransactions(user.uid).filter((transaction) => transaction.type === "debit")).toHaveLength(1);
  });
});
