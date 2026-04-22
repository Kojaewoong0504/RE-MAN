import { describe, expect, it } from "vitest";
import { resolveResultPageState } from "@/lib/onboarding/result-state";
import type { OnboardingState } from "@/lib/onboarding/storage";

const recommendedOutfit = {
  title: "기본 조합",
  items: ["검정 티셔츠", "청바지", "흰색 스니커즈"] as [string, string, string],
  reason: "지금 가진 옷으로 가능한 조합",
  try_on_prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
};

function createFeedback(diagnosis: string) {
  return {
    diagnosis,
    improvements: ["핏", "색", "신발"] as [string, string, string],
    recommended_outfit: recommendedOutfit,
    recommendation_mix: {
      primary_source: "closet" as const,
      closet_confidence: "high" as const,
      system_support_needed: false,
      missing_categories: [],
      summary: "옷장 기준 조합"
    },
    system_recommendations: [],
    today_action: "오늘 바로 할 것",
    day1_mission: "오늘 시작 행동"
  };
}

describe("resolveResultPageState", () => {
  it("recovers persisted result when local browser state has no feedback", () => {
    const localState: OnboardingState = {
      survey: {
        current_style: "청바지 + 무지 티셔츠",
        motivation: "소개팅",
        budget: "15~30만원",
        style_goal: "",
        confidence_level: ""
      }
    };
    const persistedState: OnboardingState = {
      user_id: "user-1",
      survey: localState.survey,
      feedback: createFeedback("서버에 저장된 결과"),
      feedback_history: [{ day: 1, summary: "서버 결과 요약" }]
    };

    const resolved = resolveResultPageState(localState, persistedState);

    expect(resolved.feedback?.diagnosis).toBe("서버에 저장된 결과");
    expect(resolved.feedback_history?.[0]?.summary).toBe("서버 결과 요약");
  });

  it("keeps local image input while adopting persisted feedback", () => {
    const localState: OnboardingState = {
      survey: {
        current_style: "청바지 + 무지 티셔츠",
        motivation: "소개팅",
        budget: "15~30만원",
        style_goal: "",
        confidence_level: ""
      },
      image: "data:image/png;base64,local-image"
    };
    const persistedState: OnboardingState = {
      user_id: "user-1",
      survey: localState.survey,
      feedback: createFeedback("서버 피드백"),
      feedback_history: [{ day: 1, summary: "서버 결과 요약" }]
    };

    const resolved = resolveResultPageState(localState, persistedState);

    expect(resolved.image).toBe("data:image/png;base64,local-image");
    expect(resolved.feedback?.diagnosis).toBe("서버 피드백");
  });
});
