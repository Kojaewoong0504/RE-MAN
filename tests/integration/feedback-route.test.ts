import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";

vi.mock("server-only", () => ({}));

const validFeedbackPayload = {
  image: "data:image/png;base64,abcd",
  survey: {
    current_style: "청바지 + 무지 티셔츠",
    motivation: "소개팅",
    budget: "15~30만원",
    style_goal: "전체적인 스타일 리셋",
    confidence_level: "배우는 중"
  },
  feedback_history: []
};

function buildRequest(payload: unknown, headers?: HeadersInit) {
  return new Request("http://127.0.0.1:3001/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {})
    },
    body: JSON.stringify(payload)
  });
}

describe("feedback API route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetRateLimitsForTests();
    process.env.AI_PROVIDER = "mock";
  });

  it("rejects malformed image requests before agent work", async () => {
    const { POST } = await import("@/app/api/feedback/route");
    const response = await POST(
      buildRequest({
        ...validFeedbackPayload,
        image: "data:image/gif;base64,abcd"
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_request" });
  });

  it("returns source item ids when registered closet items are used", async () => {
    const { POST } = await import("@/app/api/feedback/route");
    const response = await POST(
      buildRequest({
        ...validFeedbackPayload,
        closet_profile: {
          tops: "네이비 셔츠",
          bottoms: "검정 슬랙스",
          shoes: "흰색 스니커즈"
        },
        closet_items: [
          {
            id: "route-top-1",
            category: "tops",
            name: "네이비 셔츠"
          },
          {
            id: "route-bottom-1",
            category: "bottoms",
            name: "검정 슬랙스"
          },
          {
            id: "route-shoes-1",
            category: "shoes",
            name: "흰색 스니커즈"
          }
        ]
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommended_outfit.source_item_ids).toEqual({
      tops: "route-top-1",
      bottoms: "route-bottom-1",
      shoes: "route-shoes-1"
    });
  });

  it("rate limits unauthenticated feedback requests by client IP", async () => {
    const { POST } = await import("@/app/api/feedback/route");
    const headers = { "x-forwarded-for": "203.0.113.10" };

    for (let index = 0; index < 5; index += 1) {
      const response = await POST(buildRequest(validFeedbackPayload, headers));

      expect(response.status).toBe(200);
    }

    const blocked = await POST(buildRequest(validFeedbackPayload, headers));
    const body = await blocked.json();

    expect(blocked.status).toBe(429);
    expect(body).toMatchObject({ error: "rate_limited" });
    expect(blocked.headers.get("Retry-After")).not.toBeNull();
  });

  it("rate limits signed feedback requests by user id instead of IP", async () => {
    const { POST } = await import("@/app/api/feedback/route");
    const headers = { "x-forwarded-for": "203.0.113.11" };

    for (let index = 0; index < 5; index += 1) {
      const response = await POST(
        buildRequest(
          {
            ...validFeedbackPayload,
            user_id: "user-a"
          },
          headers
        )
      );

      expect(response.status).toBe(200);
    }

    const userBlocked = await POST(
      buildRequest(
        {
          ...validFeedbackPayload,
          user_id: "user-a"
        },
        headers
      )
    );
    const otherUserAllowed = await POST(
      buildRequest(
        {
          ...validFeedbackPayload,
          user_id: "user-b"
        },
        headers
      )
    );

    expect(userBlocked.status).toBe(429);
    expect(otherUserAllowed.status).toBe(200);
  });
});
