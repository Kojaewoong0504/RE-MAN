import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";
import {
  getCreditTransactions,
  grantPaidCreditsForTests,
  resetCreditsForTests,
  setSubscriptionForTests
} from "@/lib/credits/server";
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

const authUser = {
  uid: "feedback-route-user",
  email: "feedback-route@example.com",
  name: "Feedback Route User",
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

  return import("@/app/api/feedback/route");
}

async function buildAuthCookies(user = authUser) {
  const { issueSessionTokens } = await import("@/lib/auth/server");
  const { accessToken } = await issueSessionTokens(
    user,
    `${user.uid}-family`,
    `${user.uid}-token`
  );

  return new Map([[SESSION_COOKIE_NAMES.access, accessToken]]);
}

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
    resetCreditsForTests();
    resetRateLimitsForTests();
    process.env.AI_PROVIDER = "mock";
    process.env.AUTH_JWT_SECRET = "feedback-route-test-secret";
  });

  it("rejects feedback requests without a login session", async () => {
    const { POST } = await loadRouteWithCookies(new Map());
    const response = await POST(buildRequest(validFeedbackPayload));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "missing_access_token" });
  });

  it("rejects malformed image requests before agent work", async () => {
    const { POST } = await loadRouteWithCookies(await buildAuthCookies());
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
    const { POST } = await loadRouteWithCookies(await buildAuthCookies());
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
    expect(body).toMatchObject({
      credits_charged: 1,
      credits_remaining: 2,
      subscription_active: false
    });
    expect(body.credit_reference_id).toEqual(expect.any(String));
    expect(getCreditTransactions(authUser.uid)[0]).toMatchObject({
      type: "debit",
      delta: -1,
      reason: "style_feedback",
      reference_id: body.credit_reference_id,
      balance_after: 2
    });
  });

  it("returns body-aware safety basis and avoid notes in the final response", async () => {
    const { POST } = await loadRouteWithCookies(
      await buildAuthCookies({
        ...authUser,
        uid: "feedback-body-aware-user"
      })
    );

    const response = await POST(
      buildRequest({
        ...validFeedbackPayload,
        body_profile: {
          overall_frame: "large",
          belly_visibility: "high",
          leg_length_impression: "shorter",
          fit_risk_tags: [
            "cropped_top_risk",
            "skinny_bottom_risk",
            "strong_contrast_split_risk"
          ]
        },
        closet_items: [
          {
            id: "top-1",
            category: "tops",
            name: "검정 레귤러 티셔츠",
            fit: "레귤러",
            wear_state: "잘 맞음"
          },
          {
            id: "bottom-1",
            category: "bottoms",
            name: "차콜 팬츠",
            fit: "테이퍼드",
            wear_state: "잘 맞음"
          },
          {
            id: "shoes-1",
            category: "shoes",
            name: "검정 운동화",
            wear_state: "잘 맞음"
          }
        ]
      })
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommended_outfit.safety_basis).toEqual([
      "상체를 과하게 키우지 않음",
      "하체 라인이 안정적으로 보임",
      "지금 옷장에서 바로 재현 가능"
    ]);
    expect(body.recommended_outfit.avoid_notes).toEqual([
      "짧은 상의는 제외",
      "붙는 하의는 제외",
      "강한 상하 대비는 제외"
    ]);
  });

  it("uses provider body profile when request payload has none", async () => {
    vi.doMock("@/lib/agents/mock-feedback", () => ({
      buildMockOnboardingFeedback: () => ({
        diagnosis: "상체 볼륨이 먼저 보입니다.",
        improvements: ["핏 정리", "색 대비 완화", "신발 톤 정리"],
        body_profile: {
          overall_frame: "large",
          belly_visibility: "high",
          leg_length_impression: "shorter",
          fit_risk_tags: ["cropped_top_risk", "strong_contrast_split_risk"]
        },
        recommended_outfit: {
          title: "체형 보정 기본 조합",
          items: ["검정 티셔츠", "차콜 팬츠", "검정 신발"],
          reason: "안정적인 비율이 먼저 보이게 합니다.",
          try_on_prompt: "전신 정면 기준 자연스러운 기본 조합",
          source_item_ids: {
            tops: "top-1",
            bottoms: "bottom-1",
            shoes: "shoes-1"
          }
        },
        recommendation_mix: {
          primary_source: "closet",
          closet_confidence: "high",
          system_support_needed: false,
          missing_categories: [],
          summary: "옷장 기준 추천입니다."
        },
        system_recommendations: [],
        today_action: "오늘 바로 입어보기",
        day1_mission: "오늘 비교 시작"
      })
    }));

    const { POST } = await loadRouteWithCookies(
      await buildAuthCookies({
        ...authUser,
        uid: "feedback-provider-body-profile-user"
      })
    );

    const response = await POST(
      buildRequest({
        ...validFeedbackPayload,
        closet_items: [
          {
            id: "top-1",
            category: "tops",
            name: "검정 티셔츠",
            fit: "레귤러",
            wear_state: "잘 맞음"
          },
          {
            id: "bottom-1",
            category: "bottoms",
            name: "차콜 팬츠",
            fit: "테이퍼드",
            wear_state: "잘 맞음"
          },
          {
            id: "shoes-1",
            category: "shoes",
            name: "검정 신발",
            wear_state: "잘 맞음"
          }
        ]
      })
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.body_profile).toMatchObject({
      overall_frame: "large",
      belly_visibility: "high",
      leg_length_impression: "shorter",
      fit_risk_tags: ["cropped_top_risk", "strong_contrast_split_risk"]
    });
    expect(body.recommended_outfit.avoid_notes).toEqual([
      "짧은 상의는 제외",
      "강한 상하 대비는 제외",
      "과한 포인트는 제외"
    ]);
  });

  it("removes provider source item ids that are not valid closet matches", async () => {
    vi.doMock("@/lib/agents/mock-feedback", () => ({
      buildMockOnboardingFeedback: () => ({
        diagnosis: "진단",
        improvements: ["핏", "색", "신발"],
        recommended_outfit: {
          title: "검증 테스트 조합",
          items: ["상의", "하의", "신발"],
          reason: "요청 옷장 기준입니다.",
          try_on_prompt: "전신 정면 사진 기준 검증 테스트",
          source_item_ids: {
            tops: "valid-top",
            bottoms: "valid-top",
            shoes: "missing-shoes"
          }
        },
        today_action: "오늘 바로 비교",
        day1_mission: "오늘 바로 시작"
      })
    }));
    const { POST } = await loadRouteWithCookies(
      await buildAuthCookies({
        ...authUser,
        uid: "feedback-invalid-source-user"
      })
    );
    const response = await POST(
      buildRequest({
        ...validFeedbackPayload,
        closet_items: [
          {
            id: "valid-top",
            category: "tops",
            name: "네이비 셔츠"
          },
          {
            id: "valid-bottom",
            category: "bottoms",
            name: "검정 슬랙스"
          }
        ]
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommended_outfit.source_item_ids).toEqual({
      tops: "valid-top"
    });
  });

  it("overrides mock feedback hybrid metadata with route-composed response", async () => {
    const { POST } = await loadRouteWithCookies(
      await buildAuthCookies({
        ...authUser,
        uid: "feedback-hybrid-mock-user"
      })
    );
    const response = await POST(
      buildRequest({
        ...validFeedbackPayload,
        closet_items: [
          {
            id: "mock-top-1",
            category: "tops",
            name: "네이비 셔츠"
          },
          {
            id: "mock-bottom-1",
            category: "bottoms",
            name: "검정 슬랙스"
          },
          {
            id: "mock-shoes-1",
            category: "shoes",
            name: "흰색 스니커즈"
          }
        ]
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommendation_mix).toMatchObject({
      primary_source: "system",
      closet_confidence: "low",
      system_support_needed: true,
      missing_categories: []
    });
    expect(body.system_recommendations.length).toBeGreaterThan(0);
    expect(body.system_recommendations[0]).toMatchObject({
      mode: "reference",
      product: null
    });
    expect(body.system_recommendations.every((item: { image_url?: string }) =>
      typeof item.image_url === "string" && item.image_url.startsWith("/system-catalog/")
    )).toBe(true);
    expect(
      body.system_recommendations
        .filter((item: { category: string }) => ["tops", "bottoms", "shoes", "outerwear"].includes(item.category))
        .every(
          (item: { id: string; image_url?: string }) =>
            typeof item.image_url === "string" &&
            (!item.image_url.endsWith(".svg") ||
              item.id === "sys-shoes-white-minimal-sneakers")
        )
    ).toBe(true);
    expect(
      body.system_recommendations.some((item: { category: string }) => item.category === "outerwear")
    ).toBe(true);
    expect(
      body.system_recommendations.some((item: { category: string }) => item.category === "hats")
    ).toBe(true);
    expect(
      body.system_recommendations.some((item: { category: string }) => item.category === "bags")
    ).toBe(true);
    expect(body.primary_outfit).toMatchObject({
      title: expect.any(String),
      reason: expect.any(String)
    });
    expect(body.primary_outfit.item_ids.length).toBeGreaterThanOrEqual(3);
    expect(body.selectable_recommendations.length).toBeGreaterThan(0);
    expect(
      body.selectable_recommendations.some(
        (item: { category: string; role: string }) =>
          item.category === "tops" && item.role === "base_top"
      )
    ).toBe(true);
    expect(
      body.selectable_recommendations.some(
        (item: { category: string; role: string }) =>
          item.category === "bottoms" && item.role === "bottom"
      )
    ).toBe(true);
    expect(
      body.selectable_recommendations.some(
        (item: { category: string; role: string }) =>
          item.category === "shoes" && item.role === "shoes"
      )
    ).toBe(true);
  });

  it("keeps dedicated sneaker, hat, and bag asset paths in the composed route response", async () => {
    const { POST } = await loadRouteWithCookies(
      await buildAuthCookies({
        ...authUser,
        uid: "feedback-route-asset-user"
      })
    );
    const response = await POST(buildRequest(validFeedbackPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(
      body.system_recommendations.find((item: { id: string }) => item.id === "sys-shoes-white-minimal-sneakers")
    ).toMatchObject({
      image_url: "/system-catalog/shoes/white-minimal-sneakers.svg"
    });
    expect(
      body.system_recommendations.find((item: { id: string }) => item.id === "sys-hat-navy-ballcap")
    ).toMatchObject({
      image_url: "/system-catalog/hats/navy-ballcap.svg"
    });
    expect(
      body.system_recommendations.find((item: { id: string }) => item.id === "sys-bag-black-crossbag")
    ).toMatchObject({
      image_url: "/system-catalog/bags/black-crossbag.svg"
    });
  });

  it("builds hybrid metadata from sanitized verified source item ids for provider responses", async () => {
    process.env.AI_PROVIDER = "gemini";
    vi.doMock("@/lib/agents/gemini", async () => {
      const actual = await vi.importActual<typeof import("@/lib/agents/gemini")>(
        "@/lib/agents/gemini"
      );

      return {
        ...actual,
        generateOnboardingFeedback: () => ({
          diagnosis: "진단",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: {
            title: "하이브리드 검증 조합",
            items: ["네이비 셔츠", "검정 슬랙스", "흰색 스니커즈"],
            reason: "provider 응답",
            try_on_prompt: "provider prompt",
            source_item_ids: {
              tops: "provider-top",
              bottoms: "provider-top",
              shoes: "missing-shoes"
            }
          },
          recommendation_mix: {
            primary_source: "closet",
            closet_confidence: "high",
            system_support_needed: false,
            missing_categories: [],
            summary: "provider metadata"
          },
          system_recommendations: [],
          today_action: "액션",
          day1_mission: "미션"
        })
      };
    });

    const { POST } = await loadRouteWithCookies(
      await buildAuthCookies({
        ...authUser,
        uid: "feedback-hybrid-provider-user"
      })
    );
    const response = await POST(
      buildRequest({
        ...validFeedbackPayload,
        closet_items: [
          {
            id: "provider-top",
            category: "tops",
            name: "네이비 셔츠"
          },
          {
            id: "provider-bottom",
            category: "bottoms",
            name: "검정 슬랙스"
          },
          {
            id: "provider-shoes",
            category: "shoes",
            name: "흰색 스니커즈"
          }
        ],
        closet_strategy: {
          core_item_ids: ["provider-top", "provider-bottom"],
          caution_item_ids: [],
          optional_item_ids: ["provider-shoes"],
          items: [
            {
              id: "provider-top",
              category: "tops",
              role: "core",
              reason: "잘 맞음"
            },
            {
              id: "provider-bottom",
              category: "bottoms",
              role: "core",
              reason: "자주 입음"
            },
            {
              id: "provider-shoes",
              category: "shoes",
              role: "optional",
              reason: "후보"
            }
          ]
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommended_outfit.source_item_ids).toEqual({
      tops: "provider-top"
    });
    expect(body.recommendation_mix).toMatchObject({
      primary_source: "closet",
      closet_confidence: "medium",
      system_support_needed: true,
      missing_categories: []
    });
    expect(body.recommendation_mix.summary).not.toBe("provider metadata");
    expect(body.system_recommendations.length).toBeGreaterThan(0);
    expect(body.system_recommendations.every((item: { image_url?: string }) =>
      typeof item.image_url === "string" && item.image_url.startsWith("/system-catalog/")
    )).toBe(true);
    expect(
      body.system_recommendations
        .filter((item: { category: string }) => ["tops", "bottoms", "shoes", "outerwear"].includes(item.category))
        .every(
          (item: { id: string; image_url?: string }) =>
            typeof item.image_url === "string" &&
            (!item.image_url.endsWith(".svg") ||
              item.id === "sys-shoes-white-minimal-sneakers")
        )
    ).toBe(true);
  });

  it("returns provider-derived body profile when request body profile is absent", async () => {
    process.env.AI_PROVIDER = "gemini";
    vi.doMock("@/lib/agents/gemini", async () => {
      const actual = await vi.importActual<typeof import("@/lib/agents/gemini")>(
        "@/lib/agents/gemini"
      );

      return {
        ...actual,
        generateOnboardingFeedback: () => ({
          diagnosis: "진단",
          improvements: ["핏", "색", "신발"],
          body_profile: {
            upper_body_presence: "high",
            belly_visibility: "high",
            leg_length_impression: "shorter",
            overall_frame: "large",
            fit_risk_tags: ["cropped_top_risk", "skinny_bottom_risk"]
          },
          recommended_outfit: {
            title: "체형 반영 조합",
            items: ["검정 티셔츠", "차콜 팬츠", "검정 운동화"],
            reason: "provider 응답",
            try_on_prompt: "provider prompt",
            source_item_ids: {
              tops: "body-top",
              bottoms: "body-bottom",
              shoes: "body-shoes"
            }
          },
          recommendation_mix: {
            primary_source: "closet",
            closet_confidence: "high",
            system_support_needed: false,
            missing_categories: [],
            summary: "provider metadata"
          },
          system_recommendations: [],
          today_action: "액션",
          day1_mission: "미션"
        })
      };
    });

    const { POST } = await loadRouteWithCookies(
      await buildAuthCookies({
        ...authUser,
        uid: "feedback-provider-body-profile-user"
      })
    );
    const response = await POST(
      buildRequest({
        ...validFeedbackPayload,
        closet_items: [
          {
            id: "body-top",
            category: "tops",
            name: "검정 티셔츠",
            fit: "레귤러"
          },
          {
            id: "body-bottom",
            category: "bottoms",
            name: "차콜 팬츠",
            fit: "테이퍼드"
          },
          {
            id: "body-shoes",
            category: "shoes",
            name: "검정 운동화"
          }
        ]
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.body_profile).toEqual({
      upper_body_presence: "high",
      belly_visibility: "high",
      leg_length_impression: "shorter",
      overall_frame: "large",
      fit_risk_tags: ["cropped_top_risk", "skinny_bottom_risk"]
    });
    expect(body.recommended_outfit.avoid_notes).toEqual([
      "짧은 상의는 제외",
      "붙는 하의는 제외",
      "과한 포인트는 제외"
    ]);
  });

  it("records provider diagnostics when onboarding response validation fails", async () => {
    process.env.AI_PROVIDER = "gemini";
    const recordProviderRuntimeFailure = vi.fn();

    vi.doMock("@/lib/harness/runtime-failures", async () => {
      const actual = await vi.importActual<typeof import("@/lib/harness/runtime-failures")>(
        "@/lib/harness/runtime-failures"
      );

      return {
        ...actual,
        recordProviderRuntimeFailure
      };
    });

    vi.doMock("@/lib/agents/gemini", async () => {
      const actual = await vi.importActual<typeof import("@/lib/agents/gemini")>(
        "@/lib/agents/gemini"
      );

      return {
        ...actual,
        generateOnboardingFeedback: () => {
          throw new actual.InvalidOnboardingResponseError({
            diagnostics: [
              {
                field: "recommendation_mix",
                reason: "invalid_enum",
                details: ['missing_categories=["casual_tops"]']
              }
            ],
            rawKeys: ["diagnosis", "recommendation_mix", "today_action"],
            stabilizedKeys: [
              "diagnosis",
              "recommendation_mix",
              "system_recommendations",
              "today_action"
            ]
          });
        }
      };
    });

    const { POST } = await loadRouteWithCookies(
      await buildAuthCookies({
        ...authUser,
        uid: "feedback-provider-runtime-user"
      })
    );
    const response = await POST(buildRequest(validFeedbackPayload));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      error: "feedback_failed",
      fallback_message: expect.any(String)
    });
    expect(recordProviderRuntimeFailure).toHaveBeenCalledWith({
      route: "feedback",
      provider: "gemini",
      failureType: "invalid_onboarding_response",
      error: expect.any(Error),
      userId: "feedback-provider-runtime-user",
      diagnostics: [
        {
          field: "recommendation_mix",
          reason: "invalid_enum",
          details: ['missing_categories=["casual_tops"]']
        }
      ],
      rawKeys: ["diagnosis", "recommendation_mix", "today_action"],
      stabilizedKeys: [
        "diagnosis",
        "recommendation_mix",
        "system_recommendations",
        "today_action"
      ]
    });
  });

  it("does not charge twice when the same feedback request is replayed", async () => {
    const user = {
      ...authUser,
      uid: "feedback-idempotent-user"
    };
    const { POST } = await loadRouteWithCookies(await buildAuthCookies(user));
    const headers = { "Idempotency-Key": "feedback-request-1" };

    const first = await POST(buildRequest(validFeedbackPayload, headers));
    const firstBody = await first.json();
    const second = await POST(buildRequest(validFeedbackPayload, headers));
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
      getCreditTransactions(user.uid).filter((transaction) => transaction.type === "debit")
    ).toHaveLength(1);
  });

  it("allows subscribed users without consuming credits", async () => {
    const user = {
      ...authUser,
      uid: "feedback-subscriber"
    };
    setSubscriptionForTests(user.uid, true);

    const { POST } = await loadRouteWithCookies(await buildAuthCookies(user));
    const response = await POST(buildRequest(validFeedbackPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      credits_charged: 0,
      credits_remaining: 3,
      subscription_active: true
    });
    expect(getCreditTransactions(user.uid)[0]).toMatchObject({
      type: "subscription_usage",
      delta: 0,
      reason: "style_feedback",
      reference_id: body.credit_reference_id
    });
  });

  it("allows paid credit users after event credits are exhausted", async () => {
    const user = {
      ...authUser,
      uid: "feedback-paid-credit-user"
    };
    grantPaidCreditsForTests(user.uid, 1);

    const { POST } = await loadRouteWithCookies(await buildAuthCookies(user));

    for (let index = 0; index < 4; index += 1) {
      const response = await POST(buildRequest(validFeedbackPayload));
      expect(response.status).toBe(200);
    }

    const blocked = await POST(buildRequest(validFeedbackPayload));

    expect(blocked.status).toBe(402);
    await expect(blocked.json()).resolves.toMatchObject({
      error: "insufficient_credits",
      credits_remaining: 0,
      credits_required: 1
    });
  });

  it("rate limits signed feedback requests by user id", async () => {
    const user = {
      ...authUser,
      uid: "feedback-rate-limited-user"
    };
    setSubscriptionForTests(user.uid, true);
    const { POST } = await loadRouteWithCookies(await buildAuthCookies(user));
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
});
