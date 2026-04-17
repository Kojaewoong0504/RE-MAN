import type {
  AgentRequest,
  DailyAgentResponse,
  DeepDiveRequest,
  DeepDiveResponse,
  OnboardingAgentResponse
} from "@/lib/agents/contracts";
import {
  normalizeDailyResponse,
  normalizeDeepDiveResponse,
  normalizeOnboardingResponse,
  validateDeepDiveResponse,
  validateDailyResponse,
  validateOnboardingResponse
} from "@/lib/agents/contracts";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const DEFAULT_PRODUCTION_REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_LOCAL_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_PRODUCTION_MAX_RETRIES = 2;
const DEFAULT_LOCAL_MAX_RETRIES = 0;
const RETRY_DELAY_MS = 2000;

type AgentKind = "onboarding" | "daily" | "fit" | "color" | "occasion" | "closet";
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

function getNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getDefaultRequestTimeoutMs() {
  return getNumberEnv(
    "GEMINI_REQUEST_TIMEOUT_MS",
    process.env.NODE_ENV === "production"
      ? DEFAULT_PRODUCTION_REQUEST_TIMEOUT_MS
      : DEFAULT_LOCAL_REQUEST_TIMEOUT_MS
  );
}

function getDefaultMaxRetries() {
  return getNumberEnv(
    "GEMINI_MAX_RETRIES",
    process.env.NODE_ENV === "production"
      ? DEFAULT_PRODUCTION_MAX_RETRIES
      : DEFAULT_LOCAL_MAX_RETRIES
  );
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
  "recommended_outfit": {
    "title": "추천 조합 이름",
    "items": ["상의/겉옷", "하의", "신발"],
    "reason": "왜 이 조합이 현재 옷장과 사진에 맞는지 1~2줄",
    "try_on_prompt": "실착 이미지 생성을 위한 간결한 프롬프트 1줄",
    "source_item_ids": {"tops": "선택한 상의 id", "bottoms": "선택한 하의 id", "shoes": "선택한 신발 id"}
  },
  "today_action": "오늘 당장 할 수 있는 것 1가지",
  "day1_mission": "내일이 아니라 오늘 바로 시작할 수 있는 Day 1 미션 1줄"
}`;
  }

  if (agent === "daily") {
    return `{
  "diagnosis": "오늘 코디 진단 1~2줄",
  "improvements": ["개선 포인트 1", "개선 포인트 2", "개선 포인트 3"],
  "today_action": "오늘 당장 할 수 있는 것 1가지",
  "tomorrow_preview": "내일 미션 예고 1줄"
}`;
  }

  return `{
  "title": "${
    agent === "color"
      ? "색 조합 체크 제목"
      : agent === "occasion"
        ? "상황별 코디 체크 제목"
        : agent === "closet"
          ? "내 옷장 다른 조합 제목"
          : "핏 체크 제목"
  }",
  "diagnosis": "${
    agent === "color"
      ? "색/톤 균형 중심 진단 1~2줄"
      : agent === "occasion"
        ? "상황/목적 적합성 중심 진단 1~2줄"
        : agent === "closet"
          ? "옷장 안에서 가능한 다른 조합 진단 1~2줄"
          : "핏/실루엣 중심 진단 1~2줄"
  }",
  "focus_points": ["체크 포인트 1", "체크 포인트 2", "체크 포인트 3"],
  "recommendation": "현재 추천 조합에서 무엇을 어떻게 확인할지 1~2줄",
  "action": "지금 가진 옷으로 바로 해볼 수 있는 행동 1가지"
}`;
}

function buildInstruction(
  agent: AgentKind,
  payload: AgentRequest,
  instructionMode: InstructionMode = "default"
) {
  const preferenceProfile = payload.preference_profile;
  const closetStrategy = payload.closet_strategy;
  const strategySummary = closetStrategy?.items.length
    ? closetStrategy.items
        .map((item) => `${item.category}:${item.id}:${item.role}:${item.reason}`)
        .join(" / ")
    : "없음";

  if (instructionMode === "smoke") {
    return [
      "친한 친구 같은 스타일 코치로 답하세요.",
      "쉽고 솔직하게 말하되 공격적으로 말하지 마세요.",
      "브랜드/가격 평가 금지.",
      "반드시 JSON만 반환하세요.",
      "improvements는 정확히 3개여야 합니다.",
      "today_action은 지금 가진 옷으로 가능한 행동만 제안하세요.",
      "Day 6 이전 구매 유도 금지.",
      `설문: ${payload.survey.current_style} / ${payload.survey.motivation} / ${payload.survey.budget} / 목표=${payload.survey.style_goal || "미입력"} / 자신감=${payload.survey.confidence_level || "미입력"}`,
      payload.closet_profile
        ? `옷장 컨텍스트: 상의=${payload.closet_profile.tops || "없음"} / 하의=${payload.closet_profile.bottoms || "없음"} / 신발=${payload.closet_profile.shoes || "없음"} / 겉옷=${payload.closet_profile.outerwear || "없음"} / 피하고 싶은 것=${payload.closet_profile.avoid || "없음"}`
        : "옷장 컨텍스트: 없음",
      payload.closet_items?.length
        ? `옷장 아이템 id 목록: ${payload.closet_items
            .map(
              (item) =>
                `${item.category}:${item.id}:${item.color || ""} ${item.name}:freq=${item.wear_frequency || "미입력"}:season=${item.season || "미입력"}:condition=${item.condition || "미입력"}`
            )
            .join(" / ")}`
        : "옷장 아이템 id 목록: 없음",
      `옷장 전략: ${strategySummary}`,
      preferenceProfile
        ? `개인화 선호: 좋아한 방향=${preferenceProfile.liked_direction || "없음"} / 피할 방향=${preferenceProfile.avoid_direction || "없음"} / 메모=${preferenceProfile.note || "없음"}`
        : "개인화 선호: 없음",
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
    "모든 문장은 모바일 화면에서 바로 읽히도록 짧게 쓰세요. diagnosis/reason은 1문장, 각 action은 1문장만 허용합니다.",
    "today_action은 지금 가진 옷과 아이템으로 바로 할 수 있는 행동만 제안하세요.",
    "사용자가 구매 후보를 명시적으로 요청하지 않았으므로 쇼핑, 구매, 구입, 사세요 같은 제안을 하지 마세요.",
    "daily-agent일 때는 바로 전날 피드백에서 사용자가 무엇을 반영했는지 먼저 비교하고, 같은 지적을 반복하지 말고 오늘 달라진 점을 기준으로 말하세요.",
    "기존 피드백 이력이 있다면 오늘 진단 첫 문장에서 어제와 비교해 무엇이 나아졌는지 또는 아직 남아 있는지 분명히 말하세요.",
    `현재 작업: ${
      agent === "onboarding"
        ? "스타일 체크 세션 결과"
        : agent === "daily"
          ? "선택형 루틴 피드백"
          : agent === "fit"
            ? "핏 deep dive"
            : agent === "color"
              ? "색 조합 deep dive"
              : agent === "occasion"
                ? "상황별 코디 deep dive"
                : "내 옷장 다른 조합 deep dive"
    }.`,
    `설문 응답:
- current_style: ${payload.survey.current_style}
- motivation: ${payload.survey.motivation}
- budget: ${payload.survey.budget}
- style_goal: ${payload.survey.style_goal || "미입력"}
- confidence_level: ${payload.survey.confidence_level || "미입력"}`,
    `현재 옷장/평소 착장 컨텍스트:
- tops: ${payload.closet_profile?.tops || "미입력"}
- bottoms: ${payload.closet_profile?.bottoms || "미입력"}
- shoes: ${payload.closet_profile?.shoes || "미입력"}
- outerwear: ${payload.closet_profile?.outerwear || "미입력"}
- avoid: ${payload.closet_profile?.avoid || "미입력"}`,
    `등록된 옷장 아이템 id:
${
  payload.closet_items?.length
    ? payload.closet_items
        .map(
          (item) =>
            `- ${item.category} / id=${item.id} / ${item.color || ""} ${item.name} / size=${item.size || "미입력"} / wear=${item.wear_state || "미입력"} / freq=${item.wear_frequency || "미입력"} / season=${item.season || "미입력"} / condition=${item.condition || "미입력"}`
        )
        .join("\n")
    : "- 없음"
}`,
    `옷장 전략:
- core: ${closetStrategy?.core_item_ids.join(", ") || "없음"}
- caution: ${closetStrategy?.caution_item_ids.join(", ") || "없음"}
- optional: ${closetStrategy?.optional_item_ids.join(", ") || "없음"}
- items: ${strategySummary}`,
    `개인화 선호:
- 좋아한 방향: ${preferenceProfile?.liked_direction || "없음"}
- 피할 방향: ${preferenceProfile?.avoid_direction || "없음"}
- 최근 반응: ${preferenceProfile?.last_reaction || "없음"}
- 메모: ${preferenceProfile?.note || "없음"}`,
    `기존 피드백 이력:
${history}`,
    agent === "fit" || agent === "color" || agent === "occasion" || agent === "closet"
      ? `현재 세션 결과:
${JSON.stringify((payload as DeepDiveRequest).current_feedback, null, 2)}

${
  agent === "fit"
    ? "핏 deep dive는 새 추천을 많이 만들지 말고, 현재 추천 조합에서 상의 길이, 하의 핏, 밑단/신발 연결을 중심으로 설명하세요."
    : agent === "color"
      ? "색 조합 deep dive는 새 구매를 유도하지 말고, 현재 추천 조합과 사용자가 가진 옷 안에서 상의/하의/신발 톤 균형을 중심으로 설명하세요."
      : agent === "occasion"
        ? "상황별 코디 deep dive는 사용자의 motivation을 기준으로 소개팅, 출근, 주말 약속 같은 실제 상황에서 현재 추천 조합을 어떻게 조정할지 설명하세요. 새 구매는 유도하지 마세요."
        : "내 옷장 다른 조합 deep dive는 closet_profile에 있는 상의, 하의, 신발, 겉옷 안에서만 다른 조합을 제안하세요. 새 구매나 없는 아이템을 제안하지 마세요."
}`
      : "onboarding-agent는 recommended_outfit을 반드시 포함하세요. 추천 조합은 현재 옷장 컨텍스트를 먼저 사용하고 구매를 유도하지 마세요. preference_profile의 좋아한 방향은 유지하고 피할 방향은 반복하지 마세요. 등록된 옷장 아이템을 사용했다면 recommended_outfit.source_item_ids에 해당 id를 카테고리별로 넣으세요.",
    "closet_strategy가 있으면 core 아이템을 우선 사용하고, caution 아이템은 꼭 필요할 때만 쓰며 reason에 확인할 점을 짧게 반영하세요. optional 아이템은 겉옷처럼 상황에 따라 더하는 후보로만 취급하세요.",
    "recommended_outfit.try_on_prompt는 별도 실착 이미지 생성 API에 넘길 수 있게 짧고 구체적으로 작성하세요.",
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
  const timeoutMs = options.timeoutMs ?? getDefaultRequestTimeoutMs();

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
      const body = await response.text().catch(() => "");
      const excerpt = body.replace(/\s+/g, " ").slice(0, 500);
      throw new Error(`gemini_http_${response.status}:${excerpt || "empty_error_body"}`);
    }

    const body = (await response.json()) as GeminiResponse;
    return JSON.parse(extractText(body)) as Record<string, unknown>;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number) {
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
    options.maxRetries ?? getDefaultMaxRetries()
  );

  if (!validateOnboardingResponse(response)) {
    throw new Error("invalid_onboarding_response");
  }

  return normalizeOnboardingResponse(response as OnboardingAgentResponse);
}

export async function generateDailyFeedback(
  payload: AgentRequest,
  options: GeminiCallOptions = {}
) {
  const response = await withRetry(
    () => callGeminiApi("daily", payload, options),
    options.maxRetries ?? getDefaultMaxRetries()
  );

  if (!validateDailyResponse(response)) {
    throw new Error("invalid_daily_response");
  }

  return normalizeDailyResponse(response as DailyAgentResponse);
}

export async function generateDeepDiveFeedback(
  payload: DeepDiveRequest,
  options: GeminiCallOptions = {}
) {
  const response = await withRetry(
    () => callGeminiApi(payload.module, payload, options),
    options.maxRetries ?? getDefaultMaxRetries()
  );

  if (!validateDeepDiveResponse(response)) {
    throw new Error("invalid_deep_dive_response");
  }

  return normalizeDeepDiveResponse(response as DeepDiveResponse);
}
