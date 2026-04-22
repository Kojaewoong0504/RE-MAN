import { describe, expect, it } from "vitest";
import { buildBodyAwareRecommendation } from "@/lib/product/body-aware-recommendation";

describe("body aware recommendation", () => {
  it("removes risky short bright top and skinny bottoms for large-frame users", () => {
    const result = buildBodyAwareRecommendation({
      survey: {
        current_style: "반팔 티셔츠 + 반바지",
        motivation: "주말 외출",
        budget: "기존 옷 활용"
      },
      bodyProfile: {
        overall_frame: "large",
        belly_visibility: "high",
        leg_length_impression: "shorter",
        fit_risk_tags: [
          "cropped_top_risk",
          "skinny_bottom_risk",
          "strong_contrast_split_risk"
        ]
      },
      closetItems: [
        {
          id: "top-safe",
          category: "tops",
          name: "검정 레귤러 티셔츠",
          fit: "레귤러",
          wear_state: "잘 맞음"
        },
        {
          id: "top-risk",
          category: "tops",
          name: "밝은 짧은 티셔츠",
          fit: "크롭",
          wear_state: "타이트"
        },
        {
          id: "bottom-safe",
          category: "bottoms",
          name: "차콜 팬츠",
          fit: "테이퍼드",
          wear_state: "잘 맞음"
        },
        {
          id: "bottom-risk",
          category: "bottoms",
          name: "슬림 팬츠",
          fit: "슬림",
          wear_state: "타이트"
        },
        {
          id: "shoes-safe",
          category: "shoes",
          name: "검정 운동화",
          wear_state: "잘 맞음"
        }
      ]
    });

    expect(result.safeClosetItemIds).toEqual(["top-safe", "bottom-safe", "shoes-safe"]);
    expect(result.rejectedClosetItemIds).toEqual(
      expect.arrayContaining(["top-risk", "bottom-risk"])
    );
    expect(result.recommended_outfit.items).toEqual([
      "검정 레귤러 티셔츠",
      "차콜 팬츠",
      "검정 운동화"
    ]);
    expect(result.recommended_outfit.avoid_notes).toEqual([
      "짧은 상의는 제외",
      "붙는 하의는 제외",
      "강한 상하 대비는 제외"
    ]);
  });
});
