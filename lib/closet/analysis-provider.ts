import type { ClosetItemCategory } from "@/lib/onboarding/storage";

export type ClosetAnalysisProvider = "mock" | "gemini";

export type ClosetAnalysisResult = {
  category?: ClosetItemCategory;
  name: string;
  color: string;
  detected_type: string;
  fit: string;
  season: string;
  condition: string;
  analysis_confidence: number;
  size: string;
  size_source: "manual" | "label_ocr" | "measurement_estimate" | "unknown";
  size_confidence: number;
};

const categories: ClosetItemCategory[] = ["tops", "bottoms", "shoes", "outerwear"];
const sizeSources: ClosetAnalysisResult["size_source"][] = [
  "manual",
  "label_ocr",
  "measurement_estimate",
  "unknown"
];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

function normalizeCategory(value: unknown) {
  return categories.includes(value as ClosetItemCategory)
    ? (value as ClosetItemCategory)
    : undefined;
}

function normalizeSizeSource(value: unknown): ClosetAnalysisResult["size_source"] {
  return sizeSources.includes(value as ClosetAnalysisResult["size_source"])
    ? (value as ClosetAnalysisResult["size_source"])
    : "unknown";
}

export function normalizeClosetAnalysis(input: Partial<ClosetAnalysisResult>) {
  const sizeSource = normalizeSizeSource(input.size_source);

  return {
    category: normalizeCategory(input.category),
    name: clean(input.name),
    color: clean(input.color),
    detected_type: clean(input.detected_type),
    fit: clean(input.fit),
    season: clean(input.season),
    condition: clean(input.condition),
    analysis_confidence: clampConfidence(input.analysis_confidence),
    size: sizeSource === "unknown" ? "" : clean(input.size),
    size_source: sizeSource,
    size_confidence: sizeSource === "unknown" ? 0 : clampConfidence(input.size_confidence)
  };
}

function getProvider(input?: ClosetAnalysisProvider): ClosetAnalysisProvider {
  if (input) {
    return input;
  }

  return process.env.CLOSET_ANALYSIS_PROVIDER === "gemini" ? "gemini" : "mock";
}

async function analyzeWithMock() {
  return normalizeClosetAnalysis({
    category: "tops",
    name: "네이비 셔츠",
    color: "네이비",
    detected_type: "셔츠",
    fit: "레귤러",
    season: "봄/가을",
    condition: "깨끗함",
    analysis_confidence: 0.82,
    size: "",
    size_source: "unknown",
    size_confidence: 0
  });
}

export async function analyzeClosetImage({
  image,
  provider
}: {
  image: string;
  provider?: ClosetAnalysisProvider;
}) {
  if (!image.startsWith("data:image/")) {
    throw new Error("invalid_image");
  }

  const selectedProvider = getProvider(provider);

  if (selectedProvider === "mock") {
    return analyzeWithMock();
  }

  throw new Error("gemini_closet_analysis_not_enabled");
}
