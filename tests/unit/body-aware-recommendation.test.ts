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

  it("avoids heavy necklines and high-contrast splits when body profile signals short neck and shorter legs", () => {
    const result = buildBodyAwareRecommendation({
      survey: {
        current_style: "흰 티셔츠 + 검정 바지",
        motivation: "출근",
        budget: "기존 옷 활용"
      },
      bodyProfile: {
        neck_impression: "short",
        leg_length_impression: "shorter",
        overall_frame: "large",
        fit_risk_tags: ["heavy_neckline_risk", "strong_contrast_split_risk"]
      },
      closetItems: [
        {
          id: "top-risk-neck",
          category: "tops",
          name: "블랙 터틀넥",
          fit: "레귤러",
          wear_state: "잘 맞음",
          color: "블랙"
        },
        {
          id: "top-risk-contrast",
          category: "tops",
          name: "화이트 오버핏 티셔츠",
          fit: "오버핏",
          wear_state: "잘 맞음",
          color: "화이트"
        },
        {
          id: "top-safe",
          category: "tops",
          name: "차콜 레귤러 니트",
          fit: "레귤러",
          wear_state: "잘 맞음",
          color: "차콜"
        },
        {
          id: "bottom-safe",
          category: "bottoms",
          name: "차콜 테이퍼드 슬랙스",
          fit: "테이퍼드",
          wear_state: "잘 맞음",
          color: "차콜"
        },
        {
          id: "shoes-safe",
          category: "shoes",
          name: "검정 로퍼",
          wear_state: "잘 맞음",
          color: "블랙"
        }
      ]
    });

    expect(result.rejectedClosetItemIds).toEqual(
      expect.arrayContaining(["top-risk-neck", "top-risk-contrast"])
    );
    expect(result.recommended_outfit.items).toEqual([
      "차콜 레귤러 니트",
      "차콜 테이퍼드 슬랙스",
      "검정 로퍼"
    ]);
    expect(result.recommended_outfit.safety_basis).toEqual([
      "목선이 답답해 보이지 않음",
      "상하 밝기 차이가 과하지 않음",
      "다리 비율이 더 안정적으로 이어짐"
    ]);
    expect(result.recommended_outfit.avoid_notes).toEqual([
      "목을 덮는 상의는 제외",
      "강한 상하 대비는 제외",
      "과한 포인트는 제외"
    ]);
  });
});
