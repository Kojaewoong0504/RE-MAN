import { describe, expect, it } from "vitest";
import {
  normalizeDeepDiveResponse,
  normalizeOnboardingResponse,
  validateAgentRequest,
  validateOnboardingResponse
} from "@/lib/agents/contracts";

const longText =
  "이 문장은 화면에 그대로 들어가면 모바일에서 너무 길어져 사용자가 핵심을 빠르게 읽기 어렵기 때문에 반드시 짧게 정리되어야 합니다. 추가 설명이 계속 이어집니다. 같은 내용이 한 번 더 반복되어 카드 전체 높이를 불필요하게 늘립니다.";

describe("agent response contracts", () => {
  it("rejects malformed image input and too-short text fallback requests", () => {
    const baseRequest = {
      survey: {
        current_style: "청바지 + 무지 티셔츠",
        motivation: "소개팅",
        budget: "15~30만원"
      },
      feedback_history: []
    };

    expect(
      validateAgentRequest({
        ...baseRequest,
        image: "data:image/gif;base64,abcd"
      })
    ).toBe(false);
    expect(
      validateAgentRequest({
        ...baseRequest,
        text_description: "짧음"
      })
    ).toBe(false);
    expect(
      validateAgentRequest({
        ...baseRequest,
        text_description: "검정 후드티와 청바지를 입었어요"
      })
    ).toBe(true);
  });

  it("keeps valid onboarding responses valid after UI length normalization", () => {
    const normalized = normalizeOnboardingResponse({
      diagnosis: longText,
      improvements: [longText, longText, longText],
      recommended_outfit: {
        title: "너무 긴 추천 조합 이름이 계속 이어져서 카드 제목 영역을 망가뜨리는 경우",
        items: [longText, longText, longText],
        reason: longText,
        try_on_prompt: longText,
        source_item_ids: {
          tops: "top-1",
          bottoms: "bottom-1"
        }
      },
      today_action: longText,
      day1_mission: longText
    });

    expect(validateOnboardingResponse(normalized)).toBe(true);
    expect(normalized.diagnosis.length).toBeLessThanOrEqual(96);
    expect(normalized.improvements.every((item) => item.length <= 72)).toBe(true);
    expect(normalized.recommended_outfit.title.length).toBeLessThanOrEqual(32);
    expect(normalized.recommended_outfit.source_item_ids?.tops).toBe("top-1");
    expect(normalized.today_action.length).toBeLessThanOrEqual(72);
    expect(normalized.diagnosis.endsWith("…")).toBe(true);
  });

  it("accepts onboarding responses without source item ids for backward compatibility", () => {
    expect(
      validateOnboardingResponse({
        diagnosis: "진단",
        improvements: ["핏", "색", "신발"],
        recommended_outfit: {
          title: "기본 조합",
          items: ["상의", "하의", "신발"],
          reason: "지금 가진 옷 기준입니다.",
          try_on_prompt: "전신 정면 사진 기준 자연스러운 실착"
        },
        today_action: "옷장 확인",
        day1_mission: "오늘 바로 확인"
      })
    ).toBe(true);
  });

  it("normalizes deep-dive fields to keep result cards scannable", () => {
    const normalized = normalizeDeepDiveResponse({
      title: "아주 긴 deep dive 제목이 계속 이어져서 제목 영역을 망가뜨리는 경우",
      diagnosis: longText,
      focus_points: [longText, longText, longText],
      recommendation: longText,
      action: longText
    });

    expect(normalized.title.length).toBeLessThanOrEqual(32);
    expect(normalized.diagnosis.length).toBeLessThanOrEqual(96);
    expect(normalized.focus_points.every((item) => item.length <= 72)).toBe(true);
    expect(normalized.recommendation.length).toBeLessThanOrEqual(110);
    expect(normalized.action.length).toBeLessThanOrEqual(72);
  });
});
