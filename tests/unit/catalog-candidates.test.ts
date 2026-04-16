import { describe, expect, it } from "vitest";
import { buildProductCatalogCandidates } from "@/lib/product/catalog-candidates";

describe("product catalog candidates", () => {
  it("builds internal catalog candidates from size candidates", () => {
    const candidates = buildProductCatalogCandidates({
      styleGoal: "소개팅 전에 단정한 인상",
      sizeCandidates: [
        {
          category: "tops",
          label: "상의 사이즈 후보",
          referenceItem: "셔츠",
          size: "L",
          checkPoint: "어깨선 확인"
        },
        {
          category: "bottoms",
          label: "하의 사이즈 후보",
          referenceItem: "슬랙스",
          size: "32",
          checkPoint: "허리 확인"
        },
        {
          category: "shoes",
          label: "신발 사이즈 후보",
          referenceItem: "스니커즈",
          size: "270",
          checkPoint: "발볼 확인"
        }
      ]
    });

    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({
      category: "tops",
      title: "레귤러 옥스포드 셔츠",
      size: "L"
    });
    expect(candidates[1].title).toBe("테이퍼드 슬랙스");
    expect(candidates[2].title).toBe("화이트 레더 스니커즈");
    expect(candidates[0].reason).toContain("내부 카탈로그 후보");
  });

  it("does not return candidates when no size is supported", () => {
    const candidates = buildProductCatalogCandidates({
      sizeCandidates: [
        {
          category: "tops",
          label: "상의 사이즈 후보",
          referenceItem: "셔츠",
          size: "XXS",
          checkPoint: "어깨선 확인"
        }
      ]
    });

    expect(candidates).toEqual([]);
  });
});
