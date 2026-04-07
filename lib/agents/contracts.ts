export type SurveyInput = {
  current_style: string;
  motivation: string;
  budget: string;
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
  feedback_history: FeedbackHistoryItem[];
};

export type OnboardingAgentResponse = {
  diagnosis: string;
  improvements: [string, string, string];
  today_action: string;
  day1_mission: string;
};

export type DailyAgentResponse = {
  diagnosis: string;
  improvements: [string, string, string];
  today_action: string;
  tomorrow_preview: string;
};

export const FALLBACK_MESSAGE =
  "지금 사진 분석이 잠깐 어려운 상황이에요. 오늘 입은 옷을 간단히 텍스트로 설명해주시면 바로 피드백 드릴게요.";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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

  return true;
}

function validateImprovements(value: unknown): value is [string, string, string] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => isNonEmptyString(item))
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
