import { describe, expect, it } from "vitest";
import { buildSizeCandidates } from "@/lib/product/size-candidates";

describe("size candidate recommendations", () => {
  it("uses explicit user-entered sizes before inference", () => {
    const candidates = buildSizeCandidates({
      sizeProfile: {
        height_cm: "175",
        weight_kg: "72",
        top_size: "XL",
        bottom_size: "33",
        shoe_size_mm: "275",
        fit_preference: "너무 붙지 않는 레귤러핏"
      },
      recommendedItems: ["셔츠", "슬랙스", "스니커즈"]
    });

    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({
      label: "상의 사이즈 후보",
      referenceItem: "셔츠",
      size: "XL"
    });
    expect(candidates[1].size).toBe("33");
    expect(candidates[2].size).toBe("275");
    expect(candidates[0].checkPoint).toContain("레귤러핏");
  });

  it("falls back to coarse weight-based top and bottom candidates only", () => {
    const candidates = buildSizeCandidates({
      sizeProfile: {
        weight_kg: "73"
      },
      recommendedItems: ["니트", "치노팬츠", "로퍼"]
    });

    expect(candidates).toEqual([
      expect.objectContaining({ category: "tops", size: "L" }),
      expect.objectContaining({ category: "bottoms", size: "32" })
    ]);
  });

  it("attaches closet evidence when a registered item matches the candidate size", () => {
    const candidates = buildSizeCandidates({
      sizeProfile: {
        top_size: "L"
      },
      recommendedItems: ["셔츠", "슬랙스", "스니커즈"],
      closetItems: [
        {
          id: "top-1",
          category: "tops",
          name: "옥스포드 셔츠",
          color: "네이비",
          size: "L",
          wear_state: "잘 맞음",
          condition: "깨끗함"
        }
      ]
    });

    expect(candidates[0].closetEvidence).toEqual({
      itemName: "네이비 옥스포드 셔츠",
      size: "L",
      wearState: "잘 맞음",
      condition: "깨끗함"
    });
  });
});
