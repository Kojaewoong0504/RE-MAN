import { describe, expect, it } from "vitest";
import { normalizeBodyProfile } from "@/lib/agents/body-profile";

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
});
