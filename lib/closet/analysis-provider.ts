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
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const DEFAULT_CLOSET_ANALYSIS_TIMEOUT_MS = 30000;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

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

function getGoogleApiKey() {
  return process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
}

function getTimeoutMs() {
  const value = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_CLOSET_ANALYSIS_TIMEOUT_MS;
}

function getImagePart(image: string) {
  const matched = image.match(/^data:(.+?);base64,(.+)$/);

  if (!matched) {
    throw new Error("invalid_image");
  }

  const [, mimeType, data] = matched;
  return {
    inlineData: {
      mimeType,
      data
    }
  };
}

function extractGeminiText(response: GeminiResponse) {
  const text = (response.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (!text) {
    throw new Error("empty_gemini_closet_response");
  }

  return text;
}

function buildClosetInstruction() {
  return [
    "옷 사진 1장을 분석해 옷장 등록용 초안을 만드세요.",
    "사용자가 빠르게 수정할 수 있게 짧고 보수적으로 추정하세요.",
    "브랜드명은 이미지에서 확실히 보일 때만 name에 넣고, 확실하지 않으면 색상+의류 종류로 작성하세요.",
    "사이즈 라벨이 보이면 size_source는 label_ocr, 실측 추정이면 measurement_estimate, 모르면 unknown입니다.",
    "사이즈를 모르면 size는 빈 문자열입니다.",
    "반드시 JSON만 반환하세요.",
    `JSON 스키마:
{
  "category": "tops | bottoms | shoes | outerwear 중 하나",
  "name": "짧은 옷 이름",
  "color": "대표 색상",
  "detected_type": "셔츠/티셔츠/슬랙스/스니커즈 등",
  "fit": "슬림/레귤러/오버핏/모름 중 자연어",
  "season": "사계절/봄/여름/가을/겨울/봄/가을 등",
  "condition": "깨끗함/사용감 있음/수선 필요/모름",
  "analysis_confidence": 0.0,
  "size": "L 또는 100 등",
  "size_source": "label_ocr | measurement_estimate | unknown",
  "size_confidence": 0.0
}`
  ].join("\n");
}

async function analyzeWithGemini(image: string) {
  const apiKey = getGoogleApiKey();

  if (!apiKey) {
    throw new Error("missing_google_api_key");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildClosetInstruction()
              },
              getImagePart(image)
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const excerpt = body.replace(/\s+/g, " ").slice(0, 500);
      throw new Error(`gemini_closet_http_${response.status}:${excerpt || "empty_error_body"}`);
    }

    const body = (await response.json()) as GeminiResponse;
    return normalizeClosetAnalysis(JSON.parse(extractGeminiText(body)));
  } finally {
    clearTimeout(timeoutId);
  }
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

  return analyzeWithGemini(image);
}
