import { describe, expect, it } from "vitest";
import { buildHybridRecommendation } from "@/lib/product/recommendation-mix";

describe("hybrid recommendation mix", () => {
  it("falls back to system-first recommendations when the closet is empty", () => {
    const result = buildHybridRecommendation({
      survey: {
        current_style: "청바지 + 무지 티셔츠",
        motivation: "소개팅",
        budget: "15~30만원"
      },
      closetItems: [],
      verifiedSourceItemIds: {}
    });

    expect(result.recommendation_mix).toMatchObject({
      primary_source: "system",
      closet_confidence: "low",
      system_support_needed: true,
      missing_categories: ["tops", "bottoms", "shoes"]
    });
    expect(result.recommendation_mix.summary).toContain("시스템 추천");
    expect(result.system_recommendations.length).toBeGreaterThan(0);
    expect(result.system_recommendations.every((item) => item.mode === "reference")).toBe(true);
    expect(result.system_recommendations.every((item) => item.product === null)).toBe(true);
  });

  it("keeps closet as the primary source when the closet has enough verified support", () => {
    const result = buildHybridRecommendation({
      survey: {
        current_style: "셔츠 + 슬랙스",
        motivation: "출근",
        budget: "기존 옷 활용"
      },
      closetItems: [
        {
          id: "top-1",
          category: "tops",
          name: "네이비 셔츠"
        },
        {
          id: "bottom-1",
          category: "bottoms",
          name: "검정 슬랙스"
        },
        {
          id: "shoe-1",
          category: "shoes",
          name: "흰색 스니커즈"
        }
      ],
      closetStrategy: {
        core_item_ids: ["top-1", "bottom-1"],
        caution_item_ids: [],
        optional_item_ids: [],
        items: [
          {
            id: "top-1",
            category: "tops",
            role: "core",
            reason: "자주 입고 잘 맞음"
          },
          {
            id: "bottom-1",
            category: "bottoms",
            role: "core",
            reason: "실루엣이 안정적임"
          }
        ]
      },
      verifiedSourceItemIds: {
        tops: "top-1",
        bottoms: "bottom-1"
      }
    });

    expect(result.recommendation_mix).toEqual({
      primary_source: "closet",
      closet_confidence: "high",
      system_support_needed: false,
      missing_categories: [],
      summary: "주 조합은 옷장 기준으로 구성하고 시스템 추천은 보조로 제공합니다."
    });
    expect(result.system_recommendations.length).toBeGreaterThan(0);
    expect(result.system_recommendations.every((item) => item.mode === "reference")).toBe(true);
    expect(result.system_recommendations.every((item) => item.product === null)).toBe(true);
  });
});
