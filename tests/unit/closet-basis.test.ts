import { describe, expect, it } from "vitest";
import {
  buildClosetBasisMatches,
  buildClosetBasisSummary
} from "@/lib/product/closet-basis";

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

  it("returns short user-facing basis labels from match status and closet strategy", () => {
    const basis = buildClosetBasisMatches({
      recommendedItems: ["화이트 셔츠", "검정 슬랙스", "스니커즈"],
      sourceItemIds: {
        tops: "top-1",
        bottoms: "bottom-1"
      },
      strategyItems: [
        {
          id: "top-1",
          category: "tops",
          role: "core",
          reason: "착용감 잘 맞음 · 빈도 자주 입음 · 점수 6",
          score: 6
        },
        {
          id: "bottom-1",
          category: "bottoms",
          role: "use_with_care",
          reason: "착용감 작음 · 상태 낡음 · 점수 -3",
          score: -3
        },
        {
          id: "shoe-1",
          category: "shoes",
          role: "optional",
          reason: "추가 정보 부족 · 점수 0",
          score: 0
        }
      ],
      closetItems: [
        {
          id: "top-1",
          category: "tops",
          name: "셔츠",
          color: "화이트",
          size: "L",
          wear_state: "잘 맞음"
        },
        {
          id: "bottom-1",
          category: "bottoms",
          name: "슬랙스",
          color: "검정",
          size: "32",
          wear_state: "작음"
        },
        {
          id: "shoe-1",
          category: "shoes",
          name: "로퍼",
          color: "브라운"
        }
      ]
    });

    expect(basis[0]).toMatchObject({
      statusLabel: "추천에 사용",
      signalLabel: "자주 입고 잘 맞음",
      detailLabel: "L · 잘 맞음"
    });
    expect(basis[1]).toMatchObject({
      statusLabel: "추천에 사용",
      signalLabel: "핏/상태 확인",
      detailLabel: "32 · 작음"
    });
    expect(basis[2]).toMatchObject({
      statusLabel: "비슷한 후보",
      signalLabel: "후보"
    });
  });

  it("summarizes how much of the recommendation came from the closet", () => {
    const summary = buildClosetBasisSummary([
      {
        category: "tops",
        label: "상의",
        itemName: "흰색 무지 티셔츠",
        role: "얼굴 주변 인상을 정하는 기준",
        matchStatus: "matched",
        statusLabel: "추천에 사용",
        signalLabel: "자주 입고 잘 맞음",
        detailLabel: "L · 잘 맞음"
      },
      {
        category: "bottoms",
        label: "하의",
        itemName: "검정 슬랙스",
        role: "전체 비율과 실루엣 기준",
        matchStatus: "matched",
        statusLabel: "추천에 사용",
        signalLabel: "후보",
        detailLabel: "32"
      },
      {
        category: "shoes",
        label: "신발",
        itemName: "흰색 스니커즈",
        role: "코디가 흩어지지 않게 묶는 기준",
        matchStatus: "fallback",
        statusLabel: "비슷한 후보",
        signalLabel: "후보",
        detailLabel: "270"
      }
    ]);

    expect(summary).toEqual({
      countLabel: "상의 · 하의 · 신발 중 2개 반영",
      reasonLabel: "흰색 무지 티셔츠 중심으로 시작"
    });
  });
});
