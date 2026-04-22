import { describe, expect, it } from "vitest";
import {
  normalizeDeepDiveResponse,
  normalizeOnboardingResponse,
  sanitizeSourceItemIdsForCloset,
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
        text_description: "검정 후드티와 청바지를 입었어요",
        preference_profile: {
          liked_direction: "셔츠 조합 선호",
          note: "단정한 방향이 좋음",
          last_reaction: "helpful"
        },
        closet_strategy: {
          core_item_ids: ["top-1"],
          caution_item_ids: ["bottom-1"],
          optional_item_ids: [],
          items: [
            {
              id: "top-1",
              category: "tops",
              role: "core",
              reason: "잘 맞음"
            },
            {
              id: "bottom-1",
              category: "bottoms",
              role: "use_with_care",
              reason: "밑단 수선 필요"
            }
          ]
        }
      })
    ).toBe(true);
    expect(
      validateAgentRequest({
        ...baseRequest,
        text_description: "검정 후드티와 청바지를 입었어요",
        preference_profile: {
          last_reaction: "invalid"
        }
      })
    ).toBe(false);
    expect(
      validateAgentRequest({
        ...baseRequest,
        text_description: "검정 후드티와 청바지를 입었어요",
        closet_strategy: {
          core_item_ids: ["top-1"],
          caution_item_ids: [],
          optional_item_ids: [],
          items: [
            {
              id: "top-1",
              category: "tops",
              role: "unknown",
              reason: "잘 맞음"
            }
          ]
        }
      })
    ).toBe(false);
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
      recommendation_mix: {
        primary_source: "closet",
        closet_confidence: "high",
        system_support_needed: true,
        missing_categories: ["outerwear"],
        summary: longText
      },
      system_recommendations: [
        {
          id: "sys-top-1",
          mode: "reference",
          category: "tops",
          role: "base_top",
          title: longText,
          color: "네이비",
          fit: "레귤러",
          season: ["봄", "가을"],
          style_tags: ["clean"],
          reason: longText,
          image_url: longText,
          product: null,
          compatibility_tags: ["clean"],
          layer_order_default: 10
        }
      ],
      primary_outfit: {
        title: "기본 추천 조합",
        item_ids: ["sys-top-1", "sys-bottom-1", "sys-shoes-1"],
        reason: longText
      },
      selectable_recommendations: [
        {
          id: "sys-top-1",
          mode: "reference",
          category: "tops",
          role: "base_top",
          title: longText,
          color: "네이비",
          fit: "레귤러",
          season: ["봄", "가을"],
          style_tags: ["clean"],
          reason: longText,
          image_url: longText,
          product: null,
          compatibility_tags: ["clean"],
          layer_order_default: 10
        },
        {
          id: "sys-hat-1",
          mode: "reference",
          category: "hats",
          role: "addon",
          title: "네이비 볼캡",
          reason: "얼굴선을 가볍게 정리합니다.",
          image_url: "/system-catalog/hats/navy-ballcap.svg",
          product: null,
          compatibility_tags: ["clean"],
          layer_order_default: 60
        },
        {
          id: "sys-bag-1",
          mode: "reference",
          category: "bags",
          role: "addon",
          title: "블랙 크로스백",
          reason: "가벼운 외출에 정리감을 줍니다.",
          image_url: "/system-catalog/bags/black-crossbag.svg",
          product: null,
          compatibility_tags: ["daily"],
          layer_order_default: 70
        }
      ],
      today_action: longText,
      day1_mission: longText
    });

    expect(validateOnboardingResponse(normalized)).toBe(true);
    expect(normalized.selectable_recommendations).toBeDefined();
    expect(normalized.primary_outfit).toBeDefined();
    expect(normalized.diagnosis.length).toBeLessThanOrEqual(96);
    expect(normalized.improvements.every((item) => item.length <= 72)).toBe(true);
    expect(normalized.recommended_outfit.title.length).toBeLessThanOrEqual(32);
    expect(normalized.recommended_outfit.source_item_ids?.tops).toBe("top-1");
    expect(normalized.recommendation_mix.primary_source).toBe("closet");
    expect(normalized.recommendation_mix.summary.length).toBeLessThanOrEqual(110);
    expect(normalized.system_recommendations[0].mode).toBe("reference");
    expect(normalized.system_recommendations[0].role).toBe("base_top");
    expect(normalized.system_recommendations[0].product).toBeNull();
    expect(normalized.selectable_recommendations?.[1]?.category).toBe("hats");
    expect(normalized.selectable_recommendations?.[2]?.category).toBe("bags");
    expect(normalized.primary_outfit?.item_ids).toEqual([
      "sys-top-1",
      "sys-bottom-1",
      "sys-shoes-1"
    ]);
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
      recommendation_mix: {
        primary_source: "system",
        closet_confidence: "low",
        system_support_needed: false,
        missing_categories: [],
        summary: "시스템 추천 우선"
      },
      system_recommendations: [],
      today_action: "옷장 확인",
      day1_mission: "오늘 바로 확인"
    })
    ).toBe(true);
  });

  it("keeps only source item ids that exist in the same closet category", () => {
    expect(
      sanitizeSourceItemIdsForCloset(
        {
          tops: " top-valid ",
          bottoms: "top-valid",
          shoes: "missing-shoes",
          outerwear: "   "
        },
        [
          {
            id: "top-valid",
            category: "tops",
            name: "네이비 셔츠"
          },
          {
            id: "bottom-valid",
            category: "bottoms",
            name: "검정 슬랙스"
          }
        ]
      )
    ).toEqual({
      tops: "top-valid"
    });

    expect(
      sanitizeSourceItemIdsForCloset(
        {
          tops: "missing-top"
        },
        [
          {
            id: "bottom-valid",
            category: "bottoms",
            name: "검정 슬랙스"
          }
        ]
      )
    ).toBeUndefined();
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
