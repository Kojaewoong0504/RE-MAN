import { describe, expect, it } from "vitest";
import { stabilizeOnboardingResponseForProvider } from "@/lib/agents/gemini";

describe("gemini onboarding stabilization", () => {
  it("normalizes unsupported recommendation mix aliases and enriches body profile from text", () => {
    const stabilized = stabilizeOnboardingResponseForProvider({
      diagnosis:
        "상하의 대비가 강해서 시선이 상체에 집중되고 덩치가 부각될 위험이 있어요.",
      improvements: ["핏", "색", "신발"],
      body_profile: {
        upper_body_presence: "medium",
        overall_frame: "medium",
        fit_risk_tags: ["strong_contrast_split_risk"]
      },
      recommended_outfit: {
        title: "기본 조합",
        items: ["상의", "하의", "신발"],
        reason: "대비를 줄이고 상체를 부드럽게 감싸주면 더 정리돼 보여요.",
        try_on_prompt: "전신 정면 사진 기준 자연스러운 실착"
      },
      recommendation_mix: {
        primary_source: "system_only",
        closet_confidence: "low",
        system_support_needed: true,
        missing_categories: ["tops", "bottoms", "shoes"],
        summary: "시스템 추천 우선"
      },
      system_recommendations: [],
      today_action: "옷장 확인",
      day1_mission: "오늘 바로 확인"
    });

    expect(stabilized.recommendation_mix).toMatchObject({
      primary_source: "system"
    });
    expect(stabilized.body_profile).toMatchObject({
      upper_body_presence: "high",
      overall_frame: "large",
      fit_risk_tags: ["strong_contrast_split_risk"]
    });
  });

  it("drops unsupported missing_categories values so provider drift does not fail validation", () => {
    const stabilized = stabilizeOnboardingResponseForProvider({
      diagnosis: "기본 조합이지만 조금 더 정돈된 인상이 필요해요.",
      improvements: ["핏", "색", "신발"],
      body_profile: {
        upper_body_presence: "medium"
      },
      recommended_outfit: {
        title: "기본 조합",
        items: ["상의", "하의", "신발"],
        reason: "지금 가진 조합을 우선 정리합니다.",
        try_on_prompt: "전신 정면 사진 기준 자연스러운 실착"
      },
      recommendation_mix: {
        primary_source: "closet",
        closet_confidence: "medium",
        system_support_needed: true,
        missing_categories: ["casual_tops", "bottoms", "casual_bottoms", "outerwear"],
        summary: "옷장 기준 추천 유지"
      },
      system_recommendations: [],
      today_action: "옷장 확인",
      day1_mission: "오늘 바로 확인"
    });

    expect(stabilized.recommendation_mix).toMatchObject({
      missing_categories: ["bottoms", "outerwear"]
    });
  });
});
