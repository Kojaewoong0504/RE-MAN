export type SurveyInput = {
  current_style: string;
  motivation: string;
  budget: string;
  style_goal?: string;
  confidence_level?: string;
};

export type ClosetProfile = {
  tops: string;
  bottoms: string;
  shoes: string;
  outerwear?: string;
  avoid?: string;
};

export type FeedbackHistoryItem = {
  day: number;
  summary: string;
  action?: string;
  next_focus?: string;
};

export type AgentRequest = {
  user_id?: string;
  image?: string;
  text_description?: string;
  survey: SurveyInput;
  closet_profile?: ClosetProfile;
  feedback_history: FeedbackHistoryItem[];
};

export type OutfitRecommendation = {
  title: string;
  items: [string, string, string];
  reason: string;
  try_on_prompt: string;
};

export type OnboardingAgentResponse = {
  diagnosis: string;
  improvements: [string, string, string];
  recommended_outfit: OutfitRecommendation;
  today_action: string;
  day1_mission: string;
};

export type DailyAgentResponse = {
  diagnosis: string;
  improvements: [string, string, string];
  today_action: string;
  tomorrow_preview: string;
};

export type DeepDiveModule = "fit" | "color" | "occasion" | "closet";

export type DeepDiveRequest = AgentRequest & {
  module: DeepDiveModule;
  current_feedback: OnboardingAgentResponse;
};

export type DeepDiveResponse = {
  title: string;
  diagnosis: string;
  focus_points: [string, string, string];
  recommendation: string;
  action: string;
};

export const FALLBACK_MESSAGE =
  "지금 사진 분석이 잠깐 어려운 상황이에요. 오늘 입은 옷을 간단히 텍스트로 설명해주시면 바로 피드백 드릴게요.";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasClosetSignal(value: unknown): value is ClosetProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const closet = value as Record<string, unknown>;
  return [closet.tops, closet.bottoms, closet.shoes, closet.outerwear, closet.avoid].some(
    (item) => typeof item === "string" && item.trim().length > 0
  );
}

export function validateAgentRequest(payload: unknown): payload is AgentRequest {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const request = payload as Record<string, unknown>;
  const survey = request.survey as Record<string, unknown> | undefined;
  const history = request.feedback_history;

  if (!survey || typeof survey !== "object") {
    return false;
  }

  if (
    !isNonEmptyString(survey.current_style) ||
    !isNonEmptyString(survey.motivation) ||
    !isNonEmptyString(survey.budget)
  ) {
    return false;
  }

  if (!Array.isArray(history)) {
    return false;
  }

  if (!request.image && !request.text_description) {
    return false;
  }

  if (request.closet_profile !== undefined && !hasClosetSignal(request.closet_profile)) {
    return false;
  }

  return true;
}

function validateImprovements(value: unknown): value is [string, string, string] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => isNonEmptyString(item))
  );
}

function validateOutfitRecommendation(value: unknown): value is OutfitRecommendation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const recommendation = value as Record<string, unknown>;
  return (
    isNonEmptyString(recommendation.title) &&
    validateImprovements(recommendation.items) &&
    isNonEmptyString(recommendation.reason) &&
    isNonEmptyString(recommendation.try_on_prompt)
  );
}

export function validateOnboardingResponse(
  payload: unknown
): payload is OnboardingAgentResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const response = payload as Record<string, unknown>;
  return (
    isNonEmptyString(response.diagnosis) &&
    validateImprovements(response.improvements) &&
    validateOutfitRecommendation(response.recommended_outfit) &&
    isNonEmptyString(response.today_action) &&
    isNonEmptyString(response.day1_mission) &&
    response.tomorrow_preview === undefined
  );
}

export function validateDailyResponse(payload: unknown): payload is DailyAgentResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const response = payload as Record<string, unknown>;
  return (
    isNonEmptyString(response.diagnosis) &&
    validateImprovements(response.improvements) &&
    isNonEmptyString(response.today_action) &&
    isNonEmptyString(response.tomorrow_preview) &&
    response.day1_mission === undefined
  );
}

export function validateDeepDiveRequest(payload: unknown): payload is DeepDiveRequest {
  if (!validateAgentRequest(payload)) {
    return false;
  }

  const request = payload as Record<string, unknown>;
  return (
    (request.module === "fit" ||
      request.module === "color" ||
      request.module === "occasion" ||
      request.module === "closet") &&
    validateOnboardingResponse(request.current_feedback)
  );
}

export function validateDeepDiveResponse(payload: unknown): payload is DeepDiveResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const response = payload as Record<string, unknown>;
  return (
    isNonEmptyString(response.title) &&
    isNonEmptyString(response.diagnosis) &&
    validateImprovements(response.focus_points) &&
    isNonEmptyString(response.recommendation) &&
    isNonEmptyString(response.action)
  );
}
