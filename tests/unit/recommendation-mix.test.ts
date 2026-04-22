import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { buildHybridRecommendation } from "@/lib/product/recommendation-mix";
import { SYSTEM_STYLE_LIBRARY } from "@/lib/product/system-style-library";

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
    expect(result.system_recommendations.map((item) => item.category)).toEqual([
      "tops",
      "bottoms",
      "shoes",
      "outerwear",
      "hats",
      "bags"
    ]);
    expect(result.system_recommendations.every((item) => item.mode === "reference")).toBe(true);
    expect(result.system_recommendations.every((item) => item.product === null)).toBe(true);
    expect(result.primary_outfit.item_ids.length).toBeGreaterThanOrEqual(2);
    expect(result.selectable_recommendations.some((item) => item.role === "base_top")).toBe(true);
    expect(result.selectable_recommendations.some((item) => item.role === "bottom")).toBe(true);
    expect(result.selectable_recommendations.some((item) => item.role === "shoes")).toBe(true);
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
    expect(result.system_recommendations.map((item) => item.category)).toEqual([
      "tops",
      "bottoms",
      "shoes",
      "outerwear",
      "hats",
      "bags"
    ]);
    expect(result.system_recommendations.every((item) => item.mode === "reference")).toBe(true);
    expect(result.system_recommendations.every((item) => item.product === null)).toBe(true);
    expect(result.primary_outfit.item_ids.length).toBeGreaterThanOrEqual(3);
    expect(result.selectable_recommendations.every((item) => item.image_url)).toBe(true);
  });

  it("fills missing system support with a balanced outfit set instead of a single category", () => {
    const result = buildHybridRecommendation({
      survey: {
        current_style: "기본 티셔츠 + 반바지",
        motivation: "주말 외출",
        budget: "기존 옷 활용"
      },
      closetItems: [
        {
          id: "top-1",
          category: "tops",
          name: "검정 티셔츠"
        },
        {
          id: "shoe-1",
          category: "shoes",
          name: "검정 운동화"
        }
      ],
      closetStrategy: {
        core_item_ids: ["top-1", "shoe-1"],
        caution_item_ids: [],
        optional_item_ids: [],
        items: [
          {
            id: "top-1",
            category: "tops",
            role: "core",
            reason: "자주 입고 잘 맞음"
          }
        ]
      },
      verifiedSourceItemIds: {
        tops: "top-1"
      }
    });

    expect(result.recommendation_mix.missing_categories).toEqual(["bottoms"]);
    expect(result.system_recommendations.map((item) => item.category)).toEqual([
      "bottoms",
      "tops",
      "shoes",
      "outerwear",
      "hats",
      "bags"
    ]);
    expect(result.selectable_recommendations.slice(0, 3).map((item) => item.category)).toEqual([
      "bottoms",
      "tops",
      "shoes"
    ]);
  });

  it("includes first-phase support categories without breaking the balanced starter set", () => {
    const result = buildHybridRecommendation({
      survey: {
        current_style: "후드티 + 조거팬츠",
        motivation: "가벼운 외출",
        budget: "기존 옷 활용"
      },
      closetItems: [],
      verifiedSourceItemIds: {}
    });

    expect(result.selectable_recommendations.some((item) => item.category === "outerwear")).toBe(
      true
    );
    expect(result.selectable_recommendations.some((item) => item.category === "hats")).toBe(true);
    expect(result.selectable_recommendations.some((item) => item.category === "bags")).toBe(true);
    expect(result.selectable_recommendations.find((item) => item.category === "hats")?.role).toBe(
      "addon"
    );
  });

  it("keeps support categories in system recommendations so saved results do not lose accessory options", () => {
    const result = buildHybridRecommendation({
      survey: {
        current_style: "셔츠 + 슬랙스",
        motivation: "소개팅",
        budget: "15~30만원"
      },
      closetItems: [],
      verifiedSourceItemIds: {}
    });

    expect(result.system_recommendations.map((item) => item.category)).toEqual([
      "tops",
      "bottoms",
      "shoes",
      "outerwear",
      "hats",
      "bags"
    ]);
  });

  it("uses shipped non-placeholder image assets for core system references", () => {
    const coreReferences = SYSTEM_STYLE_LIBRARY.filter((item) =>
      ["tops", "bottoms", "shoes", "outerwear"].includes(item.category)
    );

    expect(coreReferences.length).toBeGreaterThanOrEqual(4);

    for (const item of coreReferences) {
      expect(item.image_url).toBeTruthy();
      expect(item.image_url).not.toMatch(/reference-(top|bottom|shoes|outerwear)\.svg$/);
      expect(existsSync(`./public${item.image_url}`)).toBe(true);
    }
  });

  it("uses dedicated assets for hat and bag support references", () => {
    const supportReferences = SYSTEM_STYLE_LIBRARY.filter((item) =>
      ["hats", "bags"].includes(item.category)
    );

    expect(supportReferences.map((item) => item.category)).toEqual(["hats", "bags"]);

    for (const item of supportReferences) {
      expect(item.image_url).toBeTruthy();
      expect(item.image_url).not.toMatch(/reference-(top|bottom|shoes|outerwear)\.svg$/);
      expect(existsSync(`./public${item.image_url}`)).toBe(true);
    }
  });

  it("keeps exact dedicated assets for sneaker, hat, and bag references", () => {
    const assetExpectations = {
      "sys-shoes-white-minimal-sneakers": "/system-catalog/shoes/white-minimal-sneakers.svg",
      "sys-hat-navy-ballcap": "/system-catalog/hats/navy-ballcap.svg",
      "sys-bag-black-crossbag": "/system-catalog/bags/black-crossbag.svg"
    } as const;

    for (const [id, expectedPath] of Object.entries(assetExpectations)) {
      const item = SYSTEM_STYLE_LIBRARY.find((candidate) => candidate.id === id);

      expect(item, `${id} should exist in the system library`).toBeDefined();
      expect(item?.image_url).toBe(expectedPath);
      expect(existsSync(`./public${expectedPath}`)).toBe(true);
    }
  });
});
