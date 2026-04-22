import { describe, expect, it } from "vitest";
import {
  enrichBodyProfileFromFeedbackText,
  normalizeBodyProfile
} from "@/lib/agents/body-profile";

describe("body profile normalization", () => {
  it("keeps only supported qualitative fields and risk tags", () => {
    expect(
      normalizeBodyProfile({
        upper_body_presence: "high",
        belly_visibility: "high",
        leg_length_impression: "shorter",
        fit_risk_tags: ["tight_top_risk", "unknown_tag"]
      })
    ).toEqual({
      upper_body_presence: "high",
      belly_visibility: "high",
      leg_length_impression: "shorter",
      fit_risk_tags: ["tight_top_risk"]
    });
  });

  it("enriches conservative body profile values from feedback text cues", () => {
    expect(
      enrichBodyProfileFromFeedbackText(
        {
          upper_body_presence: "medium",
          belly_visibility: "medium",
          leg_length_impression: "balanced",
          overall_frame: "medium",
          fit_risk_tags: ["strong_contrast_split_risk"]
        },
        {
          diagnosis:
            "상체가 먼저 보이고 흰 티셔츠와 어두운 하의 대비가 강해서 덩치가 부각될 수 있어요.",
          outfitReason:
            "강한 대비를 줄이고 상체를 부드럽게 감싸주면 시선이 덜 몰리고 비율이 더 안정적으로 보여요."
        }
      )
    ).toEqual({
      upper_body_presence: "high",
      belly_visibility: "medium",
      leg_length_impression: "shorter",
      overall_frame: "large",
      fit_risk_tags: ["strong_contrast_split_risk"]
    });
  });

  it("adds neckline and top-volume risks when feedback text explicitly mentions them", () => {
    expect(
      enrichBodyProfileFromFeedbackText(undefined, {
        diagnosis: "목이 답답해 보일 수 있고 상체 볼륨이 더 커 보입니다.",
        outfitReason:
          "목을 덮는 상의와 너무 오버핏인 상의를 피하면 훨씬 정리돼 보여요."
      })
    ).toEqual({
      upper_body_presence: "high",
      neck_impression: "short",
      fit_risk_tags: ["heavy_neckline_risk", "tight_top_risk"]
    });
  });
});
