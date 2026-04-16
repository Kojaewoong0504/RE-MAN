import { describe, expect, it } from "vitest";
import { buildClosetBasisMatches } from "@/lib/product/closet-basis";

describe("closet recommendation basis", () => {
  it("matches recommended outfit text to registered closet items", () => {
    const basis = buildClosetBasisMatches({
      recommendedItems: ["네이비 셔츠", "검정 슬랙스", "흰색 스니커즈"],
      closetItems: [
        {
          id: "top-1",
          category: "tops",
          name: "셔츠",
          color: "네이비",
          size: "L",
          wear_state: "잘 맞음"
        },
        {
          id: "bottom-1",
          category: "bottoms",
          name: "슬랙스",
          color: "검정",
          size: "32"
        },
        {
          id: "shoe-1",
          category: "shoes",
          name: "스니커즈",
          color: "흰색",
          size: "270"
        }
      ]
    });

    expect(basis).toHaveLength(3);
    expect(basis[0]).toMatchObject({
      category: "tops",
      itemName: "네이비 셔츠",
      matchStatus: "matched",
      size: "L",
      wearState: "잘 맞음"
    });
    expect(basis[1].matchStatus).toBe("matched");
    expect(basis[2].size).toBe("270");
  });

  it("marks unmatched category items as fallback basis and outerwear as optional", () => {
    const basis = buildClosetBasisMatches({
      recommendedItems: ["화이트 티셔츠", "청바지", "러닝화"],
      closetItems: [
        {
          id: "top-1",
          category: "tops",
          name: "니트",
          color: "브라운"
        },
        {
          id: "outer-1",
          category: "outerwear",
          name: "자켓",
          color: "차콜"
        }
      ]
    });

    expect(basis).toEqual([
      expect.objectContaining({
        category: "tops",
        itemName: "브라운 니트",
        matchStatus: "fallback"
      }),
      expect.objectContaining({
        category: "outerwear",
        itemName: "차콜 자켓",
        matchStatus: "optional"
      })
    ]);
  });

  it("uses explicit source item ids before text matching", () => {
    const basis = buildClosetBasisMatches({
      recommendedItems: ["화이트 셔츠", "검정 슬랙스", "스니커즈"],
      sourceItemIds: {
        tops: "top-2"
      },
      closetItems: [
        {
          id: "top-1",
          category: "tops",
          name: "셔츠",
          color: "화이트"
        },
        {
          id: "top-2",
          category: "tops",
          name: "니트",
          color: "네이비"
        }
      ]
    });

    expect(basis[0]).toMatchObject({
      itemName: "네이비 니트",
      matchStatus: "matched"
    });
  });
});
