import type {
  AgentRequest,
  DailyAgentResponse,
  OnboardingAgentResponse
} from "@/lib/agents/contracts";
import {
  validateDailyResponse,
  validateOnboardingResponse
} from "@/lib/agents/contracts";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

type AgentKind = "onboarding" | "daily";
type InstructionMode = "default" | "smoke";
type GeminiCallOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  instructionMode?: InstructionMode;
};

type GeminiPart =
  | { text: string }
  | {
      inlineData: {
        mimeType: string;
        data: string;
      };
    };

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGoogleApiKey() {
  return process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
}

export function resolveAiProvider() {
  if (process.env.AI_PROVIDER === "mock") {
    return "mock";
  }

  if (process.env.AI_PROVIDER === "gemini") {
    return "gemini";
  }

  if (getGoogleApiKey()) {
    return "gemini";
  }

  return process.env.NODE_ENV === "production" ? "gemini" : "mock";
}

function getJsonShape(agent: AgentKind) {
  if (agent === "onboarding") {
    return `{
  "diagnosis": "현재 스타일 진단 1~2줄",
  "improvements": ["개선 포인트 1", "개선 포인트 2", "개선 포인트 3"],
  "today_action": "오늘 당장 할 수 있는 것 1가지",
  "day1_mission": "내일이 아니라 오늘 바로 시작할 수 있는 Day 1 미션 1줄"
}`;
  }

  return `{
  "diagnosis": "오늘 코디 진단 1~2줄",
  "improvements": ["개선 포인트 1", "개선 포인트 2", "개선 포인트 3"],
  "today_action": "오늘 당장 할 수 있는 것 1가지",
  "tomorrow_preview": "내일 미션 예고 1줄"
}`;
}

function buildInstruction(
  agent: AgentKind,
  payload: AgentRequest,
  instructionMode: InstructionMode = "default"
) {
  if (instructionMode === "smoke") {
    return [
      "친한 친구 같은 스타일 코치로 답하세요.",
      "쉽고 솔직하게 말하되 공격적으로 말하지 마세요.",
      "브랜드/가격 평가 금지.",
      "반드시 JSON만 반환하세요.",
      "improvements는 정확히 3개여야 합니다.",
      "today_action은 지금 가진 옷으로 가능한 행동만 제안하세요.",
      "Day 6 이전 구매 유도 금지.",
      `설문: ${payload.survey.current_style} / ${payload.survey.motivation} / ${payload.survey.budget}`,
      payload.text_description
        ? `설명: ${payload.text_description}`
        : "설명: 이미지 없음",
      `JSON 스키마:\n${getJsonShape(agent)}`
    ].join("\n");
  }

  const history =
    payload.feedback_history.length > 0
      ? payload.feedback_history
          .map((item) =>
            [
              `- Day ${item.day}`,
              `요약: ${item.summary}`,
              item.action ? `실행: ${item.action}` : null,
              item.next_focus ? `다음 초점: ${item.next_focus}` : null
            ]
              .filter(Boolean)
              .join(" / ")
          )
          .join("\n")
      : "- 없음";

  return [
    "당신은 친한 친구 같은 스타일 코치입니다.",
    "전문 용어보다 쉬운 말을 씁니다.",
    "칭찬만 하지 않고 솔직하게 말하되 공격적이지 않습니다.",
    "절대 판단하지 마세요.",
    '금지 표현: "왜 이렇게 입었어요", "이건 좀 아닌 것 같아요".',
    "브랜드나 가격으로 사용자를 평가하지 마세요.",
    "improvements는 반드시 3개여야 합니다.",
    "today_action은 지금 가진 옷과 아이템으로 바로 할 수 있는 행동만 제안하세요.",
    "Day 6 이전 구매 유도는 금지입니다. 쇼핑, 구매, 구입, 사세요 같은 제안을 하지 마세요.",
    "daily-agent일 때는 바로 전날 피드백에서 사용자가 무엇을 반영했는지 먼저 비교하고, 같은 지적을 반복하지 말고 오늘 달라진 점을 기준으로 말하세요.",
    "기존 피드백 이력이 있다면 오늘 진단 첫 문장에서 어제와 비교해 무엇이 나아졌는지 또는 아직 남아 있는지 분명히 말하세요.",
    `현재 작업: ${agent === "onboarding" ? "최초 온보딩 피드백" : "일일 피드백"}.`,
    `설문 응답:
- current_style: ${payload.survey.current_style}
- motivation: ${payload.survey.motivation}
- budget: ${payload.survey.budget}`,
    `기존 피드백 이력:
${history}`,
    "응답은 JSON만 반환하세요. 코드펜스 없이 순수 JSON만 반환하세요.",
    `JSON 스키마:
${getJsonShape(agent)}`
  ].join("\n");
}

function getImagePart(image: string): GeminiPart | null {
  const matched = image.match(/^data:(.+?);base64,(.+)$/);

  if (!matched) {
    return null;
  }

  const [, mimeType, data] = matched;
  return {
    inlineData: {
      mimeType,
      data
    }
  };
}

function buildParts(
  agent: AgentKind,
  payload: AgentRequest,
  instructionMode: InstructionMode = "default"
): GeminiPart[] {
  const parts: GeminiPart[] = [{ text: buildInstruction(agent, payload, instructionMode) }];
  const imagePart = payload.image ? getImagePart(payload.image) : null;

  if (imagePart) {
    parts.push({
      text: "아래 이미지를 보고 실제 코디의 핏, 컬러, 레이어, 인상을 분석하세요."
    });
    parts.push(imagePart);
  } else if (payload.text_description) {
    parts.push({
      text: `사용자 텍스트 설명: ${payload.text_description}`
    });
  }

  return parts;
}

function extractText(response: GeminiResponse) {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("empty_gemini_response");
  }

  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function callGeminiApi(
  agent: AgentKind,
  payload: AgentRequest,
  options: GeminiCallOptions = {}
) {
  const apiKey = getGoogleApiKey();
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  if (!apiKey) {
    throw new Error("missing_google_api_key");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
            parts: buildParts(agent, payload, options.instructionMode)
          }
        ],
        generationConfig: {
          temperature: 0.5,
          responseMimeType: "application/json"
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`gemini_http_${response.status}`);
    }

    const body = (await response.json()) as GeminiResponse;
    return JSON.parse(extractText(body)) as Record<string, unknown>;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      await sleep(RETRY_DELAY_MS);
    }
  }

  throw new Error("retry_exhausted");
}

export async function generateOnboardingFeedback(
  payload: AgentRequest,
  options: GeminiCallOptions = {}
) {
  const response = await withRetry(
    () => callGeminiApi("onboarding", payload, options),
    options.maxRetries
  );

  if (!validateOnboardingResponse(response)) {
    throw new Error("invalid_onboarding_response");
  }

  return response as OnboardingAgentResponse;
}

export async function generateDailyFeedback(
  payload: AgentRequest,
  options: GeminiCallOptions = {}
) {
  const response = await withRetry(
    () => callGeminiApi("daily", payload, options),
    options.maxRetries
  );

  if (!validateDailyResponse(response)) {
    throw new Error("invalid_daily_response");
  }

  return response as DailyAgentResponse;
}
