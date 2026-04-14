import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type DeepDiveRequest,
  validateDeepDiveRequest,
  validateDeepDiveResponse
} from "@/lib/agents/contracts";
import { generateDeepDiveFeedback } from "@/lib/agents/gemini";
import { buildMockDeepDiveFeedback } from "@/lib/agents/mock-feedback";

const baseFeedback = {
  diagnosis: "현재 스타일 진단",
  improvements: ["핏", "색", "신발"] as [string, string, string],
  recommended_outfit: {
    title: "기본 조합",
    items: ["검정 티셔츠", "청바지", "흰색 스니커즈"] as [string, string, string],
    reason: "지금 가진 옷으로 가능한 조합",
    try_on_prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
  },
  today_action: "상의 길이를 확인해보세요.",
  day1_mission: "옷장 조합을 확인해보세요."
};

const baseRequest: DeepDiveRequest = {
  module: "fit",
  text_description: "검정 티셔츠와 청바지를 입은 전신 사진",
  survey: {
    current_style: "검정 티셔츠 + 청바지",
    motivation: "소개팅",
    budget: "15~30만원"
  },
  feedback_history: [],
  current_feedback: baseFeedback
};

const validDeepDiveResponse = {
  title: "핏 체크",
  diagnosis: "상의 길이와 하의 라인을 먼저 보면 됩니다.",
  focus_points: ["상의 길이", "하의 라인", "신발 연결"] as [
    string,
    string,
    string
  ],
  recommendation: "기본 조합에서 상의 길이만 먼저 비교하세요.",
  action: "상의를 넣은 버전과 뺀 버전을 비교하세요."
};

describe("deep-dive contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("accepts fit, color, occasion, and closet modules with the current onboarding feedback", () => {
    expect(validateDeepDiveRequest(baseRequest)).toBe(true);
    expect(
      validateDeepDiveRequest({
        ...baseRequest,
        module: "color"
      })
    ).toBe(true);
    expect(
      validateDeepDiveRequest({
        ...baseRequest,
        module: "occasion"
      })
    ).toBe(true);
    expect(
      validateDeepDiveRequest({
        ...baseRequest,
        module: "closet"
      })
    ).toBe(true);
  });

  it("rejects unsupported modules and malformed current feedback", () => {
    expect(
      validateDeepDiveRequest({
        ...baseRequest,
        module: "season"
      })
    ).toBe(false);

    expect(
      validateDeepDiveRequest({
        ...baseRequest,
        current_feedback: {
          ...baseFeedback,
          improvements: ["핏", "색"]
        }
      })
    ).toBe(false);
  });

  it("requires three focus points in deep-dive responses", () => {
    expect(validateDeepDiveResponse(validDeepDiveResponse)).toBe(true);
    expect(
      validateDeepDiveResponse({
        ...validDeepDiveResponse,
        focus_points: ["상의 길이", "하의 라인"]
      })
    ).toBe(false);
  });

  it("returns module-specific mock feedback for fit, color, occasion, and closet checks", () => {
    expect(buildMockDeepDiveFeedback(baseRequest)).toMatchObject({
      title: "핏 체크",
      focus_points: expect.arrayContaining([
        "상의 끝이 골반을 너무 많이 덮으면 다리가 짧아 보여요."
      ])
    });

    expect(
      buildMockDeepDiveFeedback({
        ...baseRequest,
        module: "color"
      })
    ).toMatchObject({
      title: "색 조합 체크",
      focus_points: expect.arrayContaining([
        "상의와 신발 중 하나를 비슷한 밝기로 맞추면 조합이 더 안정적으로 보여요."
      ])
    });

    expect(
      buildMockDeepDiveFeedback({
        ...baseRequest,
        module: "occasion"
      })
    ).toMatchObject({
      title: "상황별 코디 체크",
      focus_points: expect.arrayContaining([
        "소개팅이나 첫 만남이면 너무 편한 인상보다 상의와 신발의 단정함을 먼저 보세요."
      ])
    });

    expect(
      buildMockDeepDiveFeedback({
        ...baseRequest,
        closet_profile: {
          tops: "검정 티셔츠",
          bottoms: "청바지",
          shoes: "흰색 스니커즈",
          outerwear: "셔츠"
        },
        module: "closet"
      })
    ).toMatchObject({
      title: "내 옷장 다른 조합",
      focus_points: expect.arrayContaining([
        "셔츠가 있다면 상의 위에 하나만 더해도 집안복 느낌이 줄어듭니다."
      ])
    });
  });

  it("sends current feedback context to Gemini for color deep dives", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(validDeepDiveResponse) }]
            }
          }
        ]
      })
    });

    vi.stubEnv("GOOGLE_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateDeepDiveFeedback(
        {
          ...baseRequest,
          module: "color"
        },
        { maxRetries: 0 }
      )
    ).resolves.toMatchObject(validDeepDiveResponse);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const prompt = body.contents[0].parts[0].text as string;

    expect(prompt).toContain("색 조합 deep dive");
    expect(prompt).toContain("현재 세션 결과");
    expect(prompt).toContain(baseFeedback.recommended_outfit.title);
  });

  it("rejects malformed Gemini deep-dive responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    ...validDeepDiveResponse,
                    focus_points: ["하나만 반환"]
                  })
                }
              ]
            }
          }
        ]
      })
    });

    vi.stubEnv("GOOGLE_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateDeepDiveFeedback(baseRequest, { maxRetries: 0 })).rejects.toThrow(
      "invalid_deep_dive_response"
    );
  });
});
