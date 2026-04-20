import { describe, expect, it } from "vitest";
import {
  analyzeClosetImage,
  normalizeClosetAnalysis
} from "@/lib/closet/analysis-provider";

const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

describe("closet analysis provider", () => {
  it("normalizes invalid provider fields to safe unknown size", () => {
    const result = normalizeClosetAnalysis({
      category: "invalid" as never,
      name: "  네이비 셔츠  ",
      color: " 네이비 ",
      analysis_confidence: 2,
      size: "L",
      size_source: "unknown",
      size_confidence: 0.9
    });

    expect(result).toMatchObject({
      category: undefined,
      name: "네이비 셔츠",
      color: "네이비",
      analysis_confidence: 1,
      size: "",
      size_source: "unknown",
      size_confidence: 0
    });
  });

  it("returns deterministic mock analysis", async () => {
    const result = await analyzeClosetImage({ image, provider: "mock" });

    expect(result.name).toBeTruthy();
    expect(result.size_source).toBe("unknown");
    expect(result.size).toBe("");
  });
});
