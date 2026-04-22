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
  hats?: string;
  bags?: string;
  avoid?: string;
};

export type AgentClosetItemCategory =
  | "tops"
  | "bottoms"
  | "shoes"
  | "outerwear"
  | "hats"
  | "bags";

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
  score?: number;
};

export type ClosetStrategy = {
  core_item_ids: string[];
  caution_item_ids: string[];
  optional_item_ids: string[];
  items: ClosetStrategyItem[];
};

export type RecommendationRole =
  | "base_top"
  | "mid_top"
  | "outerwear"
  | "bottom"
  | "shoes"
  | "addon";

export type RecommendationPrimarySource = "closet" | "system";
export type ClosetConfidence = "high" | "medium" | "low";

export type RecommendationMix = {
  primary_source: RecommendationPrimarySource;
  closet_confidence: ClosetConfidence;
  system_support_needed: boolean;
  missing_categories: AgentClosetItemCategory[];
  summary: string;
};

export type SystemRecommendation = {
  id: string;
  mode: "reference";
  category: AgentClosetItemCategory;
  role?: RecommendationRole;
  title: string;
  color?: string;
  fit?: string;
  season?: string[];
  style_tags?: string[];
  reason: string;
  image_url?: string;
  product: null;
  compatibility_tags?: string[];
  layer_order_default?: number;
};

export type PrimaryOutfit = {
  title: string;
  item_ids: string[];
  reason: string;
};

export type SelectableRecommendation = SystemRecommendation & {
  role: RecommendationRole;
  compatibility_tags?: string[];
  layer_order_default?: number;
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
  recommendation_mix: RecommendationMix;
  system_recommendations: SystemRecommendation[];
  primary_outfit?: PrimaryOutfit;
  selectable_recommendations?: SelectableRecommendation[];
  today_action: string;
  day1_mission: string;
};

export type LegacyOnboardingAgentResponse = Omit<
  OnboardingAgentResponse,
  "recommendation_mix" | "system_recommendations"
>;

export type DailyAgentResponse = {
  diagnosis: string;
  improvements: [string, string, string];
  today_action: string;
  tomorrow_preview: string;
};

export type DeepDiveModule = "fit" | "color" | "occasion" | "closet";

export type DeepDiveRequest = AgentRequest & {
  module: DeepDiveModule;
  current_feedback: OnboardingAgentResponse | LegacyOnboardingAgentResponse;
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
  return [
    closet.tops,
    closet.bottoms,
    closet.shoes,
    closet.outerwear,
    closet.hats,
    closet.bags,
    closet.avoid
  ].some(
    (item) => typeof item === "string" && item.trim().length > 0
  );
}

function isValidClosetCategory(value: unknown): value is AgentClosetItemCategory {
  return (
    value === "tops" ||
    value === "bottoms" ||
    value === "shoes" ||
    value === "outerwear" ||
    value === "hats" ||
    value === "bags"
  );
}

function isValidRecommendationRole(value: unknown): value is RecommendationRole {
  return (
    value === "base_top" ||
    value === "mid_top" ||
    value === "outerwear" ||
    value === "bottom" ||
    value === "shoes" ||
    value === "addon"
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
        isValidClosetCategory(record.category) &&
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
        isValidClosetCategory(record.category) &&
        (record.role === "core" ||
          record.role === "use_with_care" ||
          record.role === "optional") &&
        isNonEmptyString(record.reason) &&
        (record.score === undefined || typeof record.score === "number")
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
          (key === "tops" ||
            key === "bottoms" ||
            key === "shoes" ||
            key === "outerwear" ||
            key === "hats" ||
            key === "bags") &&
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

function validateLegacyOnboardingResponse(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    isNonEmptyString(response.diagnosis) &&
    validateImprovements(response.improvements) &&
    validateOutfitRecommendation(response.recommended_outfit) &&
    isNonEmptyString(response.today_action) &&
    isNonEmptyString(response.day1_mission)
  );
}

function validateRecommendationMix(value: unknown): value is RecommendationMix {
  if (!value || typeof value !== "object") {
    return false;
  }

  const mix = value as Record<string, unknown>;
  return (
    (mix.primary_source === "closet" || mix.primary_source === "system") &&
    (mix.closet_confidence === "high" ||
      mix.closet_confidence === "medium" ||
      mix.closet_confidence === "low") &&
    typeof mix.system_support_needed === "boolean" &&
    Array.isArray(mix.missing_categories) &&
    mix.missing_categories.every((category) => isValidClosetCategory(category)) &&
    isNonEmptyString(mix.summary)
  );
}

function validateSystemRecommendation(value: unknown): value is SystemRecommendation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const recommendation = value as Record<string, unknown>;
  return (
    isNonEmptyString(recommendation.id) &&
    recommendation.mode === "reference" &&
    isValidClosetCategory(recommendation.category) &&
    (recommendation.role === undefined || isValidRecommendationRole(recommendation.role)) &&
    isNonEmptyString(recommendation.title) &&
    (recommendation.color === undefined || typeof recommendation.color === "string") &&
    (recommendation.fit === undefined || typeof recommendation.fit === "string") &&
    (recommendation.season === undefined ||
      (Array.isArray(recommendation.season) &&
        recommendation.season.every((item) => typeof item === "string"))) &&
    (recommendation.style_tags === undefined ||
      (Array.isArray(recommendation.style_tags) &&
        recommendation.style_tags.every((item) => typeof item === "string"))) &&
    isNonEmptyString(recommendation.reason) &&
    (recommendation.image_url === undefined || typeof recommendation.image_url === "string") &&
    recommendation.product === null &&
    (recommendation.compatibility_tags === undefined ||
      (Array.isArray(recommendation.compatibility_tags) &&
        recommendation.compatibility_tags.every((item) => typeof item === "string"))) &&
    (recommendation.layer_order_default === undefined ||
      typeof recommendation.layer_order_default === "number")
  );
}

function validatePrimaryOutfit(value: unknown): value is PrimaryOutfit {
  if (!value || typeof value !== "object") {
    return false;
  }

  const outfit = value as Record<string, unknown>;
  return (
    isNonEmptyString(outfit.title) &&
    Array.isArray(outfit.item_ids) &&
    outfit.item_ids.every((item) => typeof item === "string" && item.trim().length > 0) &&
    isNonEmptyString(outfit.reason)
  );
}

function normalizeSourceItemIds(
  value: OutfitRecommendation["source_item_ids"]
): OutfitRecommendation["source_item_ids"] {
  if (!value) {
    return undefined;
  }

  return (["tops", "bottoms", "shoes", "outerwear", "hats", "bags"] as AgentClosetItemCategory[]).reduce<
    NonNullable<OutfitRecommendation["source_item_ids"]>
  >((acc, category) => {
    const itemId = value[category]?.trim();

    if (itemId) {
      acc[category] = itemId;
    }

    return acc;
  }, {});
}

function normalizeSystemRecommendation(
  recommendation: SystemRecommendation
): SystemRecommendation {
  return {
    id: recommendation.id.trim(),
    mode: "reference",
    category: recommendation.category,
    role: recommendation.role,
    title: compactResponseText(recommendation.title, RESPONSE_LIMITS.outfitTitle),
    color: recommendation.color ? compactResponseText(recommendation.color, RESPONSE_LIMITS.improvement) : undefined,
    fit: recommendation.fit ? compactResponseText(recommendation.fit, RESPONSE_LIMITS.improvement) : undefined,
    season: recommendation.season,
    style_tags: recommendation.style_tags,
    reason: compactResponseText(recommendation.reason, RESPONSE_LIMITS.outfitReason),
    image_url: recommendation.image_url?.trim() || undefined,
    product: null,
    compatibility_tags: recommendation.compatibility_tags,
    layer_order_default: recommendation.layer_order_default
  };
}

export function sanitizeSourceItemIdsForCloset(
  value: OutfitRecommendation["source_item_ids"],
  closetItems: AgentClosetItem[] | undefined
): OutfitRecommendation["source_item_ids"] {
  const normalized = normalizeSourceItemIds(value);

  if (!normalized || !closetItems?.length) {
    return undefined;
  }

  const sanitized = (["tops", "bottoms", "shoes", "outerwear", "hats", "bags"] as AgentClosetItemCategory[])
    .reduce<NonNullable<OutfitRecommendation["source_item_ids"]>>((acc, category) => {
      const itemId = normalized[category];

      if (
        itemId &&
        closetItems.some((item) => item.id === itemId && item.category === category)
      ) {
        acc[category] = itemId;
      }

      return acc;
    }, {});

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
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
    validateRecommendationMix(response.recommendation_mix) &&
    Array.isArray(response.system_recommendations) &&
    response.system_recommendations.every(validateSystemRecommendation) &&
    (response.primary_outfit === undefined || validatePrimaryOutfit(response.primary_outfit)) &&
    (response.selectable_recommendations === undefined ||
      (Array.isArray(response.selectable_recommendations) &&
        response.selectable_recommendations.every(validateSystemRecommendation))) &&
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
    validateLegacyOnboardingResponse(request.current_feedback)
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
    recommendation_mix: {
      primary_source: response.recommendation_mix.primary_source,
      closet_confidence: response.recommendation_mix.closet_confidence,
      system_support_needed: response.recommendation_mix.system_support_needed,
      missing_categories: response.recommendation_mix.missing_categories,
      summary: compactResponseText(
        response.recommendation_mix.summary,
        RESPONSE_LIMITS.outfitReason
      )
    },
    system_recommendations: response.system_recommendations.map(normalizeSystemRecommendation),
    primary_outfit: response.primary_outfit
      ? {
          title: compactResponseText(response.primary_outfit.title, RESPONSE_LIMITS.outfitTitle),
          item_ids: response.primary_outfit.item_ids
            .map((itemId) => itemId.trim())
            .filter((itemId) => itemId.length > 0),
          reason: compactResponseText(response.primary_outfit.reason, RESPONSE_LIMITS.outfitReason)
        }
      : undefined,
    selectable_recommendations: response.selectable_recommendations?.map(
      normalizeSystemRecommendation
    ) as SelectableRecommendation[] | undefined,
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
