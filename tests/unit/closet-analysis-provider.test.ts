import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeClosetImage,
  normalizeClosetAnalysis
} from "@/lib/closet/analysis-provider";

const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

describe("closet analysis provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

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

  it("uses Gemini vision for real closet analysis and normalizes the result", async () => {
    vi.stubEnv("GOOGLE_API_KEY", "test-google-key");
    const fetchSpy = vi.fn(async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    category: "tops",
                    name: "  옥스포드 셔츠  ",
                    color: "화이트",
                    detected_type: "셔츠",
                    fit: "레귤러",
                    season: "봄/가을",
                    condition: "깨끗함",
                    analysis_confidence: 0.91,
                    size: "L",
                    size_source: "label_ocr",
                    size_confidence: 0.78
                  })
                }
              ]
            }
          }
        ]
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await analyzeClosetImage({ image, provider: "gemini" });

    expect(result).toMatchObject({
      category: "tops",
      name: "옥스포드 셔츠",
      size: "L",
      size_source: "label_ocr",
      size_confidence: 0.78
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("key=test-google-key");
    expect(JSON.stringify(init)).toContain("옷 사진 1장을 분석");
  });
});
