import {
  isValidTextDescription,
  validateImageDataUrl
} from "@/lib/upload/photo-input";

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

export type AgentClosetItemCategory = "tops" | "bottoms" | "shoes" | "outerwear";

export type AgentClosetItem = {
  id: string;
  category: AgentClosetItemCategory;
  name: string;
  color?: string;
  fit?: string;
  size?: string;
  wear_state?: string;
  wear_frequency?: string;
  season?: string;
  condition?: string;
  notes?: string;
};

export type ClosetStrategyRole = "core" | "use_with_care" | "optional";

export type ClosetStrategyItem = {
  id: string;
  category: AgentClosetItemCategory;
  role: ClosetStrategyRole;
  reason: string;
};

export type ClosetStrategy = {
  core_item_ids: string[];
  caution_item_ids: string[];
  optional_item_ids: string[];
  items: ClosetStrategyItem[];
};

export type FeedbackHistoryItem = {
  day: number;
  summary: string;
  action?: string;
  next_focus?: string;
};

export type PreferenceProfile = {
  liked_direction?: string;
  avoid_direction?: string;
  note?: string;
  last_reaction?: "helpful" | "not_sure" | "save_for_later";
};

export type AgentRequest = {
  user_id?: string;
  image?: string;
  text_description?: string;
  survey: SurveyInput;
  closet_profile?: ClosetProfile;
  closet_items?: AgentClosetItem[];
  closet_strategy?: ClosetStrategy;
  feedback_history: FeedbackHistoryItem[];
  preference_profile?: PreferenceProfile;
};

export type OutfitRecommendation = {
  title: string;
  items: [string, string, string];
  reason: string;
  try_on_prompt: string;
  source_item_ids?: Partial<Record<AgentClosetItemCategory, string>>;
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

const RESPONSE_LIMITS = {
  diagnosis: 96,
  improvement: 72,
  outfitTitle: 32,
  outfitReason: 110,
  tryOnPrompt: 140,
  action: 72,
  mission: 72,
  deepDiveTitle: 32,
  deepDiveRecommendation: 110
} as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function compactResponseText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeTriple(
  values: [string, string, string],
  maxLength: number
): [string, string, string] {
  return [
    compactResponseText(values[0], maxLength),
    compactResponseText(values[1], maxLength),
    compactResponseText(values[2], maxLength)
  ];
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

function validateClosetItems(value: unknown): value is AgentClosetItem[] {
  if (value === undefined) {
    return true;
  }

  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const record = item as Record<string, unknown>;
    return (
      isNonEmptyString(record.id) &&
      (record.category === "tops" ||
        record.category === "bottoms" ||
        record.category === "shoes" ||
        record.category === "outerwear") &&
      isNonEmptyString(record.name)
    );
  });
}

function validateClosetStrategy(value: unknown): value is ClosetStrategy {
  if (value === undefined) {
    return true;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const strategy = value as Record<string, unknown>;
  const idGroups = [
    strategy.core_item_ids,
    strategy.caution_item_ids,
    strategy.optional_item_ids
  ];

  const hasValidIdGroups = idGroups.every(
    (group) =>
      Array.isArray(group) && group.every((itemId) => typeof itemId === "string" && itemId.trim())
  );

  const hasValidItems =
    Array.isArray(strategy.items) &&
    strategy.items.every((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const record = item as Record<string, unknown>;
      return (
        isNonEmptyString(record.id) &&
        (record.category === "tops" ||
          record.category === "bottoms" ||
          record.category === "shoes" ||
          record.category === "outerwear") &&
        (record.role === "core" ||
          record.role === "use_with_care" ||
          record.role === "optional") &&
        isNonEmptyString(record.reason)
      );
    });

  return hasValidIdGroups && hasValidItems;
}

function validatePreferenceProfile(value: unknown): value is PreferenceProfile {
  if (value === undefined) {
    return true;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const profile = value as Record<string, unknown>;
  const stringFields = [profile.liked_direction, profile.avoid_direction, profile.note];
  const hasValidStrings = stringFields.every(
    (field) => field === undefined || typeof field === "string"
  );
  const hasValidReaction =
    profile.last_reaction === undefined ||
    profile.last_reaction === "helpful" ||
    profile.last_reaction === "not_sure" ||
    profile.last_reaction === "save_for_later";

  return hasValidStrings && hasValidReaction;
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

  const hasValidImage =
    request.image !== undefined && validateImageDataUrl(request.image).ok;
  const hasValidTextDescription =
    request.text_description !== undefined &&
    isValidTextDescription(
      typeof request.text_description === "string" ? request.text_description : undefined
    );

  if (request.image !== undefined && !hasValidImage) {
    return false;
  }

  if (request.text_description !== undefined && !hasValidTextDescription) {
    return false;
  }

  if (!hasValidImage && !hasValidTextDescription) {
    return false;
  }

  if (request.closet_profile !== undefined && !hasClosetSignal(request.closet_profile)) {
    return false;
  }

  if (!validateClosetItems(request.closet_items)) {
    return false;
  }

  if (!validateClosetStrategy(request.closet_strategy)) {
    return false;
  }

  if (!validatePreferenceProfile(request.preference_profile)) {
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
  const sourceItemIds = recommendation.source_item_ids;
  const hasValidSourceItemIds =
    sourceItemIds === undefined ||
    (typeof sourceItemIds === "object" &&
      sourceItemIds !== null &&
      Object.entries(sourceItemIds).every(
        ([key, itemId]) =>
          (key === "tops" || key === "bottoms" || key === "shoes" || key === "outerwear") &&
          typeof itemId === "string"
      ));

  return (
    isNonEmptyString(recommendation.title) &&
    validateImprovements(recommendation.items) &&
    isNonEmptyString(recommendation.reason) &&
    isNonEmptyString(recommendation.try_on_prompt) &&
    hasValidSourceItemIds
  );
}

function normalizeSourceItemIds(
  value: OutfitRecommendation["source_item_ids"]
): OutfitRecommendation["source_item_ids"] {
  if (!value) {
    return undefined;
  }

  return (["tops", "bottoms", "shoes", "outerwear"] as AgentClosetItemCategory[]).reduce<
    NonNullable<OutfitRecommendation["source_item_ids"]>
  >((acc, category) => {
    const itemId = value[category]?.trim();

    if (itemId) {
      acc[category] = itemId;
    }

    return acc;
  }, {});
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

export function normalizeOnboardingResponse(
  response: OnboardingAgentResponse
): OnboardingAgentResponse {
  return {
    diagnosis: compactResponseText(response.diagnosis, RESPONSE_LIMITS.diagnosis),
    improvements: normalizeTriple(response.improvements, RESPONSE_LIMITS.improvement),
    recommended_outfit: {
      title: compactResponseText(response.recommended_outfit.title, RESPONSE_LIMITS.outfitTitle),
      items: normalizeTriple(response.recommended_outfit.items, RESPONSE_LIMITS.improvement),
      reason: compactResponseText(response.recommended_outfit.reason, RESPONSE_LIMITS.outfitReason),
      try_on_prompt: compactResponseText(
        response.recommended_outfit.try_on_prompt,
        RESPONSE_LIMITS.tryOnPrompt
      ),
      source_item_ids: normalizeSourceItemIds(response.recommended_outfit.source_item_ids)
    },
    today_action: compactResponseText(response.today_action, RESPONSE_LIMITS.action),
    day1_mission: compactResponseText(response.day1_mission, RESPONSE_LIMITS.mission)
  };
}

export function normalizeDailyResponse(response: DailyAgentResponse): DailyAgentResponse {
  return {
    diagnosis: compactResponseText(response.diagnosis, RESPONSE_LIMITS.diagnosis),
    improvements: normalizeTriple(response.improvements, RESPONSE_LIMITS.improvement),
    today_action: compactResponseText(response.today_action, RESPONSE_LIMITS.action),
    tomorrow_preview: compactResponseText(response.tomorrow_preview, RESPONSE_LIMITS.mission)
  };
}

export function normalizeDeepDiveResponse(response: DeepDiveResponse): DeepDiveResponse {
  return {
    title: compactResponseText(response.title, RESPONSE_LIMITS.deepDiveTitle),
    diagnosis: compactResponseText(response.diagnosis, RESPONSE_LIMITS.diagnosis),
    focus_points: normalizeTriple(response.focus_points, RESPONSE_LIMITS.improvement),
    recommendation: compactResponseText(
      response.recommendation,
      RESPONSE_LIMITS.deepDiveRecommendation
    ),
    action: compactResponseText(response.action, RESPONSE_LIMITS.action)
  };
}
