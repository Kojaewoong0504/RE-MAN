"use client";

import type {
  AgentRequest,
  ClosetStrategy,
  ClosetStrategyRole,
  ClosetProfile,
  DailyAgentResponse,
  DeepDiveModule,
  DeepDiveResponse,
  FeedbackHistoryItem,
  OnboardingAgentResponse,
  SurveyInput
} from "@/lib/agents/contracts";
import {
  normalizeClosetDraft,
  type ClosetItemDraft
} from "@/lib/closet/batch";
import {
  buildClosetBasisMatches,
  type ClosetBasisItem
} from "@/lib/product/closet-basis";

const ONBOARDING_STORAGE_KEY = "reman:onboarding";
const HISTORY_SUMMARY_MAX_LENGTH = 64;

export type OnboardingInput = {
  survey: SurveyInput;
  closet_profile?: ClosetProfile;
  closet_items?: ClosetItem[];
  image?: string;
  text_description?: string;
};

export type ClosetItemCategory = "tops" | "bottoms" | "shoes" | "outerwear";

export type ClosetItem = {
  id: string;
  category: ClosetItemCategory;
  name: string;
  photo_data_url?: string;
  color?: string;
  fit?: string;
  size?: string;
  wear_state?: string;
  wear_frequency?: string;
  season?: string;
  condition?: string;
  notes?: string;
};

export type SizeProfile = {
  height_cm?: string;
  weight_kg?: string;
  top_size?: string;
  bottom_size?: string;
  shoe_size_mm?: string;
  fit_preference?: string;
};

export type RecommendationFeedbackReaction = "helpful" | "not_sure" | "save_for_later";

export type RecommendationFeedback = {
  reaction: RecommendationFeedbackReaction;
  note?: string;
  outfit_title: string;
  created_at: string;
};

export type RecommendationFeedbackMemoryRow = {
  label: "좋아한 방향" | "피할 방향" | "보류 후보" | "메모";
  value: string;
};

export type TryOnPreviewCacheEntry = {
  cache_key: string;
  source: "reference" | "upload";
  reference_id?: string;
  prompt: string;
  provider: "mocked" | "vertex";
  preview_image: string;
  message: string;
  created_at: string;
};

export type OnboardingState = OnboardingInput & {
  user_id?: string;
  email?: string;
  size_profile?: SizeProfile;
  closet_item_drafts?: ClosetItemDraft[];
  feedback?: OnboardingAgentResponse;
  daily_feedbacks?: Record<string, DailyAgentResponse>;
  deep_dive_feedbacks?: Partial<Record<DeepDiveModule, DeepDiveResponse>>;
  try_on_previews?: Record<string, TryOnPreviewCacheEntry>;
  recommendation_feedback?: RecommendationFeedback;
  feedback_history?: FeedbackHistoryItem[];
  fallback_message?: string;
};

export type StyleProgramStatus = "new" | "active" | "completed";
export type StyleProgramSnapshot = {
  status: StyleProgramStatus;
  entryPath: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  summaryLabel: string | null;
  summaryBody: string | null;
};

export type StyleFeedbackTimelineItem = {
  id: string;
  label: string;
  title: string;
  summary: string;
  action?: string;
  basis?: ClosetBasisItem[];
  reaction?: string;
  reactionNote?: string;
};

const defaultSurvey: SurveyInput = {
  current_style: "",
  motivation: "",
  budget: "",
  style_goal: "",
  confidence_level: ""
};

const defaultClosetProfile: ClosetProfile = {
  tops: "",
  bottoms: "",
  shoes: "",
  outerwear: "",
  avoid: ""
};

const closetCategories: ClosetItemCategory[] = ["tops", "bottoms", "shoes", "outerwear"];
const requiredStyleClosetCategories = ["tops", "bottoms", "shoes"] as const satisfies ReadonlyArray<ClosetItemCategory>;
const closetCategoryLabels: Record<ClosetItemCategory, string> = {
  tops: "상의",
  bottoms: "하의",
  shoes: "신발",
  outerwear: "겉옷"
};
const sizeProfileKeys = [
  "height_cm",
  "weight_kg",
  "top_size",
  "bottom_size",
  "shoe_size_mm",
  "fit_preference"
] as const satisfies ReadonlyArray<keyof SizeProfile>;

function getEmptyState(): OnboardingState {
  return {
    survey: defaultSurvey
  };
}

function isStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function compactText(value: string, maxLength = HISTORY_SUMMARY_MAX_LENGTH) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function getPrimaryHistorySummary(summary: string) {
  return compactText(summary.split(" / 실행:")[0].split(" / 다음 초점:")[0]);
}

function buildHistorySummary(summary: string) {
  return compactText(summary);
}

function buildHistoryAction(action?: string) {
  if (!action?.trim()) {
    return undefined;
  }

  return compactText(action);
}

function buildHistoryNextFocus(nextFocus?: string) {
  if (!nextFocus?.trim()) {
    return undefined;
  }

  return compactText(nextFocus);
}

function buildRecommendationFeedbackSummary(feedback: RecommendationFeedback | undefined) {
  if (!feedback) {
    return "";
  }

  const parts = [`내 반응: ${getRecommendationFeedbackLabel(feedback.reaction)}`];

  if (feedback.note?.trim()) {
    parts.push(`메모: ${compactText(feedback.note, 48)}`);
  }

  return parts.join(" / ");
}

function buildPreferenceProfile(feedback: RecommendationFeedback | undefined) {
  if (!feedback) {
    return undefined;
  }

  const note = feedback.note?.trim() ? compactText(feedback.note, 72) : undefined;

  if (feedback.reaction === "helpful") {
    return {
      liked_direction: `${compactText(feedback.outfit_title, 36)} 방향 선호`,
      note,
      last_reaction: feedback.reaction
    };
  }

  if (feedback.reaction === "not_sure") {
    return {
      avoid_direction: `${compactText(feedback.outfit_title, 36)} 방향은 애매함`,
      note,
      last_reaction: feedback.reaction
    };
  }

  return {
    liked_direction: `${compactText(feedback.outfit_title, 36)} 방향은 후보로 보류`,
    note,
    last_reaction: feedback.reaction
  };
}

export function buildRecommendationFeedbackMemory(
  feedback: RecommendationFeedback | undefined
): RecommendationFeedbackMemoryRow[] {
  if (!feedback) {
    return [];
  }

  const title = compactText(feedback.outfit_title, 36);
  const rows: RecommendationFeedbackMemoryRow[] = [];

  if (feedback.reaction === "helpful") {
    rows.push({ label: "좋아한 방향", value: title });
  } else if (feedback.reaction === "not_sure") {
    rows.push({ label: "피할 방향", value: title });
  } else {
    rows.push({ label: "보류 후보", value: title });
  }

  if (feedback.note?.trim()) {
    rows.push({ label: "메모", value: compactText(feedback.note, 48) });
  }

  return rows;
}

function buildHistoryPreview(item: FeedbackHistoryItem) {
  const parts = [getPrimaryHistorySummary(item.summary)];

  if (item.action) {
    parts.push(`실행 ${compactText(item.action, 42)}`);
  }

  return `Day ${item.day}: ${parts.join(" · ")}`;
}

function getClosetProfileOrUndefined(profile: ClosetProfile | undefined) {
  if (!profile || !Object.values(profile).some((value) => value?.trim())) {
    return undefined;
  }

  return profile;
}

function isClosetItemCategory(value: unknown): value is ClosetItemCategory {
  return (
    typeof value === "string" &&
    closetCategories.includes(value as ClosetItemCategory)
  );
}

function compactClosetItemText(item: ClosetItem) {
  const name = item.name.trim() || "옷장 사진";
  const color = item.color?.trim();
  const shouldPrefixColor = Boolean(color && !name.includes(color));

  return [
    shouldPrefixColor ? color : null,
    name,
    item.fit ? `(${item.fit})` : null,
    item.size ? `[${item.size}]` : null,
    item.wear_state ? `{${item.wear_state}}` : null,
    item.wear_frequency ? `빈도:${item.wear_frequency}` : null,
    item.season ? `계절:${item.season}` : null,
    item.condition ? `상태:${item.condition}` : null,
    item.notes ? `- ${item.notes}` : null
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeClosetItems(items: unknown): ClosetItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index): ClosetItem | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const category = isClosetItemCategory(record.category) ? record.category : null;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const photoDataUrl =
        typeof record.photo_data_url === "string" && record.photo_data_url.startsWith("data:image/")
          ? record.photo_data_url
          : "";

      if (!category || (!name && !photoDataUrl)) {
        return null;
      }

      return {
        id:
          typeof record.id === "string" && record.id.trim()
            ? record.id.trim()
            : `closet-${index}`,
        category,
        name: name || `옷장 사진 ${index + 1}`,
        photo_data_url: photoDataUrl,
        color: typeof record.color === "string" ? record.color.trim() : "",
        fit: typeof record.fit === "string" ? record.fit.trim() : "",
        size: typeof record.size === "string" ? record.size.trim() : "",
        wear_state: typeof record.wear_state === "string" ? record.wear_state.trim() : "",
        wear_frequency:
          typeof record.wear_frequency === "string" ? record.wear_frequency.trim() : "",
        season: typeof record.season === "string" ? record.season.trim() : "",
        condition: typeof record.condition === "string" ? record.condition.trim() : "",
        notes: typeof record.notes === "string" ? record.notes.trim() : ""
      } satisfies ClosetItem;
    })
    .filter((item): item is ClosetItem => Boolean(item));
}

export function buildClosetProfileFromItems(
  items: ClosetItem[] | undefined,
  avoid?: string
): ClosetProfile {
  const normalizedItems = normalizeClosetItems(items);
  const byCategory = closetCategories.reduce<Record<ClosetItemCategory, string[]>>(
    (acc, category) => {
      acc[category] = [];
      return acc;
    },
    {} as Record<ClosetItemCategory, string[]>
  );

  normalizedItems.forEach((item) => {
    byCategory[item.category].push(compactClosetItemText(item));
  });

  return {
    tops: byCategory.tops.join(", "),
    bottoms: byCategory.bottoms.join(", "),
    shoes: byCategory.shoes.join(", "),
    outerwear: byCategory.outerwear.join(", "),
    avoid: avoid?.trim() ?? ""
  };
}

export function buildClosetItemsFromProfile(profile: ClosetProfile | undefined): ClosetItem[] {
  if (!profile) {
    return [];
  }

  return closetCategories.flatMap((category) => {
    const raw = profile[category];

    if (!raw?.trim()) {
      return [];
    }

    return raw
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name, index) => ({
        id: `legacy-${category}-${index}`,
        category,
        name
      }));
  });
}

export function getClosetItemCount(state: OnboardingState) {
  return normalizeClosetItems(state.closet_items).length;
}

export function getMinimumClosetReadiness(items: ClosetItem[] | undefined) {
  const normalizedItems = normalizeClosetItems(items);
  const presentCategories = requiredStyleClosetCategories.filter((category) =>
    normalizedItems.some((item) => item.category === category)
  );
  const missingCategories = requiredStyleClosetCategories.filter(
    (category) => !presentCategories.includes(category)
  );

  return {
    isReady: missingCategories.length === 0,
    presentCategories,
    missingCategories,
    requiredCategories: [...requiredStyleClosetCategories]
  };
}

export function getClosetCategoryLabel(category: ClosetItemCategory) {
  return closetCategoryLabels[category];
}

function toAgentClosetItems(items: ClosetItem[] | undefined) {
  return normalizeClosetItems(items).map((item) => ({
    id: item.id,
    category: item.category,
    name: item.name,
    color: item.color,
    fit: item.fit,
    size: item.size,
    wear_state: item.wear_state,
    wear_frequency: item.wear_frequency,
    season: item.season,
    condition: item.condition,
    notes: item.notes
  }));
}

function getClosetStrategySignalText(item: ClosetItem) {
  return [item.wear_state, item.notes, item.fit, item.wear_frequency, item.condition, item.season]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function countSignal(text: string, keywords: string[], score: number) {
  return keywords.some((keyword) => text.includes(keyword)) ? score : 0;
}

function countComfortSignal(text: string) {
  if (text.includes("불편")) {
    return 0;
  }

  return countSignal(text, ["잘 맞", "편함"], 2);
}

export function getClosetStrategyScore(item: ClosetItem) {
  const text = getClosetStrategySignalText(item);

  return [
    countComfortSignal(text),
    countSignal(text, ["자주", "주 2", "주 3", "매일"], 2),
    countSignal(text, ["깨끗", "좋음"], 1),
    countSignal(text, ["사계절"], 1),
    countSignal(text, ["기본", "무난", "단정", "깔끔"], 1),
    countSignal(text, ["거의 안", "안 입"], -2),
    countSignal(
      text,
      ["작", "큼", "낡", "오염", "불편", "애매", "주의", "수선", "타이트", "헐렁"],
      -3
    )
  ].reduce((total, value) => total + value, 0);
}

function getClosetStrategyRole(item: ClosetItem, score: number): ClosetStrategyRole {
  if (score <= -2) {
    return "use_with_care";
  }

  if (item.category === "outerwear") {
    return "optional";
  }

  if (score >= 3) {
    return "core";
  }

  return "optional";
}

function buildScoreReason(item: ClosetItem, score: number) {
  const signals = [
    item.wear_state ? `착용감 ${item.wear_state}` : null,
    item.wear_frequency ? `빈도 ${item.wear_frequency}` : null,
    item.condition ? `상태 ${item.condition}` : null,
    item.season ? `계절 ${item.season}` : null
  ].filter(Boolean);

  return compactText(
    `${signals.join(" · ") || item.notes || "추가 정보 부족"} · 점수 ${score}`,
    52
  );
}

function buildClosetStrategyReason(item: ClosetItem, role: ClosetStrategyRole, score: number) {
  const scoreReason = buildScoreReason(item, score);

  if (role === "core") {
    return scoreReason;
  }

  if (role === "use_with_care") {
    return scoreReason;
  }

  return scoreReason;
}

export function buildClosetStrategy(items: ClosetItem[] | undefined): ClosetStrategy | undefined {
  const normalizedItems = normalizeClosetItems(items);

  if (!normalizedItems.length) {
    return undefined;
  }

  const strategyItems = normalizedItems.map((item) => {
    const score = getClosetStrategyScore(item);
    const role = getClosetStrategyRole(item, score);

    return {
      id: item.id,
      category: item.category,
      role,
      reason: buildClosetStrategyReason(item, role, score),
      score
    };
  });

  return {
    core_item_ids: strategyItems
      .filter((item) => item.role === "core")
      .map((item) => item.id),
    caution_item_ids: strategyItems
      .filter((item) => item.role === "use_with_care")
      .map((item) => item.id),
    optional_item_ids: strategyItems
      .filter((item) => item.role === "optional")
      .map((item) => item.id),
    items: strategyItems
  };
}

export function normalizeSizeProfile(profile: unknown): SizeProfile {
  if (!profile || typeof profile !== "object") {
    return {};
  }

  const record = profile as Record<string, unknown>;

  return sizeProfileKeys.reduce<SizeProfile>((acc, key) => {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      acc[key] = value.trim();
    }

    return acc;
  }, {});
}

export function hasSizeProfileSignal(profile: SizeProfile | undefined) {
  return Object.values(normalizeSizeProfile(profile)).some(Boolean);
}

export function normalizeRecommendationFeedback(input: unknown): RecommendationFeedback | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const reaction = record.reaction;

  if (reaction !== "helpful" && reaction !== "not_sure" && reaction !== "save_for_later") {
    return undefined;
  }

  if (typeof record.outfit_title !== "string" || !record.outfit_title.trim()) {
    return undefined;
  }

  return {
    reaction,
    note: typeof record.note === "string" ? record.note.trim() : undefined,
    outfit_title: record.outfit_title.trim(),
    created_at:
      typeof record.created_at === "string" && record.created_at.trim()
        ? record.created_at.trim()
        : new Date().toISOString()
  };
}

export function readOnboardingState(): OnboardingState {
  if (!isStorageAvailable()) {
    return getEmptyState();
  }

  const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);

  if (!raw) {
    return getEmptyState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      survey: {
        ...defaultSurvey,
        ...parsed.survey
      },
      closet_profile: {
        ...defaultClosetProfile,
        ...parsed.closet_profile
      },
      closet_items: normalizeClosetItems(parsed.closet_items),
      closet_item_drafts: Array.isArray(parsed.closet_item_drafts)
        ? parsed.closet_item_drafts.map((draft) => normalizeClosetDraft(draft))
        : [],
      size_profile: normalizeSizeProfile(parsed.size_profile),
      user_id: parsed.user_id,
      email: parsed.email,
      image: parsed.image,
      text_description: parsed.text_description,
      feedback: parsed.feedback,
      daily_feedbacks: parsed.daily_feedbacks ?? {},
      deep_dive_feedbacks: parsed.deep_dive_feedbacks ?? {},
      try_on_previews: parsed.try_on_previews ?? {},
      recommendation_feedback: normalizeRecommendationFeedback(parsed.recommendation_feedback),
      feedback_history: parsed.feedback_history ?? [],
      fallback_message: parsed.fallback_message
    };
  } catch {
    return getEmptyState();
  }
}

export function writeOnboardingState(nextState: OnboardingState) {
  if (!isStorageAvailable()) {
    return;
  }

  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(nextState));
}

export function patchOnboardingState(patch: Partial<OnboardingState>) {
  const current = readOnboardingState();
  const nextState: OnboardingState = {
    ...current,
    ...patch,
    survey: {
      ...current.survey,
      ...patch.survey
    },
    closet_profile: {
      ...defaultClosetProfile,
      ...current.closet_profile,
      ...patch.closet_profile
    },
    closet_items:
      patch.closet_items !== undefined
        ? normalizeClosetItems(patch.closet_items)
        : normalizeClosetItems(current.closet_items),
    closet_item_drafts:
      patch.closet_item_drafts !== undefined
        ? patch.closet_item_drafts.map((draft) => normalizeClosetDraft(draft))
        : current.closet_item_drafts?.map((draft) => normalizeClosetDraft(draft)) ?? [],
    size_profile:
      patch.size_profile !== undefined
        ? normalizeSizeProfile(patch.size_profile)
        : normalizeSizeProfile(current.size_profile),
    recommendation_feedback:
      patch.recommendation_feedback !== undefined
        ? normalizeRecommendationFeedback(patch.recommendation_feedback)
        : normalizeRecommendationFeedback(current.recommendation_feedback)
  };

  writeOnboardingState(nextState);
  return nextState;
}

export function clearOnboardingState() {
  if (!isStorageAvailable()) {
    return;
  }

  window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

export function buildOnboardingRequest(state: OnboardingState): AgentRequest | null {
  const { survey, closet_profile, closet_items, image, text_description, user_id } = state;

  if (
    !survey.current_style.trim() ||
    !survey.motivation.trim() ||
    !survey.budget.trim() ||
    (!image && !text_description)
  ) {
    return null;
  }

  const itemProfile = buildClosetProfileFromItems(closet_items, closet_profile?.avoid);
  const hasItemProfile = Object.values(itemProfile).some((value) => value?.trim());

  return {
    user_id,
    survey,
    closet_profile: getClosetProfileOrUndefined(
      hasItemProfile
        ? {
            ...defaultClosetProfile,
            ...closet_profile,
            ...itemProfile,
            avoid: closet_profile?.avoid ?? itemProfile.avoid
          }
        : closet_profile
    ),
    closet_items: toAgentClosetItems(closet_items),
    closet_strategy: buildClosetStrategy(closet_items),
    image,
    text_description,
    feedback_history: state.feedback_history ?? [],
    preference_profile: buildPreferenceProfile(state.recommendation_feedback)
  };
}

function hasCompletedSurvey(state: OnboardingState) {
  return Boolean(
    state.survey.current_style.trim() &&
      state.survey.motivation.trim() &&
      state.survey.budget.trim()
  );
}

function getLatestDailyDay(state: OnboardingState) {
  return Math.max(
    1,
    ...Object.keys(state.daily_feedbacks ?? {})
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  );
}

export function getStyleProgramLatestDay(state: OnboardingState) {
  if (!state.feedback) {
    return 0;
  }

  return getLatestDailyDay(state);
}

export function mergePersistedProgramState(
  current: OnboardingState,
  persisted: OnboardingState | null
): OnboardingState {
  if (!persisted?.user_id) {
    return current;
  }

  const currentDay = getStyleProgramLatestDay(current);
  const persistedDay = getStyleProgramLatestDay(persisted);
  const shouldPreferPersistedProgram = persistedDay > currentDay;

  return {
    ...current,
    user_id: persisted.user_id,
    email: persisted.email ?? current.email,
    survey: shouldPreferPersistedProgram
      ? {
          ...defaultSurvey,
          ...persisted.survey
        }
      : {
          ...defaultSurvey,
          ...current.survey,
          ...persisted.survey
        },
    closet_profile: shouldPreferPersistedProgram
      ? {
          ...defaultClosetProfile,
          ...persisted.closet_profile
        }
      : {
          ...defaultClosetProfile,
          ...current.closet_profile,
          ...persisted.closet_profile
        },
    closet_items: shouldPreferPersistedProgram
      ? normalizeClosetItems(persisted.closet_items).length
        ? normalizeClosetItems(persisted.closet_items)
        : buildClosetItemsFromProfile(persisted.closet_profile)
      : normalizeClosetItems(current.closet_items).length
        ? normalizeClosetItems(current.closet_items)
        : normalizeClosetItems(persisted.closet_items),
    size_profile: shouldPreferPersistedProgram
      ? normalizeSizeProfile(persisted.size_profile)
      : hasSizeProfileSignal(current.size_profile)
        ? normalizeSizeProfile(current.size_profile)
        : normalizeSizeProfile(persisted.size_profile),
    feedback: shouldPreferPersistedProgram ? persisted.feedback : current.feedback ?? persisted.feedback,
    daily_feedbacks: shouldPreferPersistedProgram
      ? persisted.daily_feedbacks ?? {}
      : {
          ...(persisted.daily_feedbacks ?? {}),
          ...(current.daily_feedbacks ?? {})
        },
    deep_dive_feedbacks: shouldPreferPersistedProgram
      ? persisted.deep_dive_feedbacks ?? current.deep_dive_feedbacks ?? {}
      : {
          ...(persisted.deep_dive_feedbacks ?? {}),
          ...(current.deep_dive_feedbacks ?? {})
        },
    try_on_previews: {
      ...(persisted.try_on_previews ?? {}),
      ...(current.try_on_previews ?? {})
    },
    recommendation_feedback:
      current.recommendation_feedback ?? persisted.recommendation_feedback,
    feedback_history: shouldPreferPersistedProgram
      ? persisted.feedback_history ?? []
      : current.feedback_history?.length
        ? current.feedback_history
        : persisted.feedback_history ?? [],
    image: current.image,
    text_description: current.text_description,
    fallback_message: current.fallback_message ?? persisted.fallback_message
  };
}

export function getStyleProgramStatus(state: OnboardingState): StyleProgramStatus {
  if (!state.feedback) {
    return "new";
  }

  const latestDay = getLatestDailyDay(state);
  return latestDay >= 7 ? "completed" : "active";
}

export function getStyleProgramEntryPath(state: OnboardingState) {
  if (!hasCompletedSurvey(state)) {
    return "/programs/style/onboarding/survey";
  }

  if (!state.feedback) {
    if (state.image || state.text_description?.trim()) {
      return "/programs/style/onboarding/upload";
    }

    return "/programs/style/onboarding/survey";
  }

  return "/programs/style/onboarding/result";
}

export function getStyleProgramSnapshot(state: OnboardingState): StyleProgramSnapshot {
  const status = getStyleProgramStatus(state);
  const entryPath = getStyleProgramEntryPath(state);

  if (status === "new") {
    return {
      status,
      entryPath,
      primaryLabel: "프로그램 보기",
      secondaryLabel: null,
      summaryLabel: "Status",
      summaryBody: "아직 시작한 프로그램이 없습니다. 먼저 바꾸고 싶은 영역을 고르세요."
    };
  }

  if (status === "active") {
    return {
      status,
      entryPath: "/programs/style/onboarding/upload?reset=photo",
      primaryLabel: "새 스타일 체크 시작",
      secondaryLabel: "프로그램 보기",
      summaryLabel: "Current Program",
      summaryBody: "새 사진 체크 가능"
    };
  }

  return {
    status,
    entryPath: "/programs/style/onboarding/upload?reset=photo",
    primaryLabel: "새 스타일 체크 시작",
    secondaryLabel: "다른 프로그램 보기",
    summaryLabel: "Completed Program",
    summaryBody: "새 사진 체크 가능"
  };
}

export function buildDailyRequest(
  state: OnboardingState,
  day: number
): AgentRequest | null {
  const { survey, closet_profile, closet_items, image, text_description, feedback_history = [], user_id } = state;

  if (
    day < 2 ||
    !survey.current_style.trim() ||
    !survey.motivation.trim() ||
    !survey.budget.trim() ||
    (!image && !text_description)
  ) {
    return null;
  }

  const itemProfile = buildClosetProfileFromItems(closet_items, closet_profile?.avoid);
  const hasItemProfile = Object.values(itemProfile).some((value) => value?.trim());

  return {
    user_id,
    survey,
    closet_profile: getClosetProfileOrUndefined(hasItemProfile ? itemProfile : closet_profile),
    closet_items: toAgentClosetItems(closet_items),
    closet_strategy: buildClosetStrategy(closet_items),
    image,
    text_description,
    feedback_history,
    preference_profile: buildPreferenceProfile(state.recommendation_feedback)
  };
}

export function buildHistoryFromState(state: OnboardingState) {
  const nextHistory: FeedbackHistoryItem[] = [];

  if (state.feedback?.diagnosis) {
    const reactionSummary = buildRecommendationFeedbackSummary(state.recommendation_feedback);
    nextHistory.push({
      day: 1,
      summary: buildHistorySummary(
        reactionSummary
          ? `${reactionSummary} / ${state.feedback.diagnosis}`
          : state.feedback.diagnosis
      ),
      action: buildHistoryAction(state.feedback.today_action),
      next_focus: buildHistoryNextFocus(state.feedback.day1_mission)
    });
  }

  const dailyEntries = Object.entries(state.daily_feedbacks ?? {})
    .map(([day, feedback]) => ({
      day: Number(day),
      summary: buildHistorySummary(feedback.diagnosis),
      action: buildHistoryAction(feedback.today_action),
      next_focus: buildHistoryNextFocus(feedback.tomorrow_preview)
    }))
    .filter((entry) => Number.isFinite(entry.day))
    .sort((left, right) => left.day - right.day);

  nextHistory.push(...dailyEntries);

  return nextHistory;
}

export function syncHistoryFromState(state: OnboardingState) {
  const nextHistory = buildHistoryFromState(state);

  const nextState = {
    ...state,
    feedback_history: nextHistory
  };

  writeOnboardingState(nextState);
  return nextState;
}

export function getRecentHistoryPreview(state: OnboardingState, limit = 3) {
  return (state.feedback_history ?? [])
    .slice(-limit)
    .map(buildHistoryPreview);
}

export function getStyleFeedbackTimeline(state: OnboardingState): StyleFeedbackTimelineItem[] {
  const timeline: StyleFeedbackTimelineItem[] = [];

  if (state.feedback) {
    const recommendationFeedback = state.recommendation_feedback;
    const normalizedClosetItems = normalizeClosetItems(state.closet_items);
    timeline.push({
      id: "style-check",
      label: "Style Check",
      title: state.feedback.recommended_outfit.title,
      summary: recommendationFeedback
        ? `${state.feedback.diagnosis} / 내 반응: ${getRecommendationFeedbackLabel(recommendationFeedback.reaction)}`
        : state.feedback.diagnosis,
      action: state.feedback.today_action,
      basis: buildClosetBasisMatches({
        closetItems: normalizedClosetItems,
        recommendedItems: state.feedback.recommended_outfit.items,
        sourceItemIds: state.feedback.recommended_outfit.source_item_ids,
        strategyItems: buildClosetStrategy(normalizedClosetItems)?.items
      }),
      reaction: recommendationFeedback
        ? getRecommendationFeedbackLabel(recommendationFeedback.reaction)
        : undefined,
      reactionNote: recommendationFeedback?.note
    });
  }

  Object.entries(state.daily_feedbacks ?? {})
    .map(([day, feedback]) => ({
      day: Number(day),
      feedback
    }))
    .filter((entry) => Number.isFinite(entry.day))
    .sort((left, right) => left.day - right.day)
    .forEach(({ day, feedback }) => {
      timeline.push({
        id: `day-${day}`,
        label: `Routine Day ${day}`,
        title: `Day ${day} 피드백`,
        summary: feedback.diagnosis,
        action: feedback.today_action
      });
    });

  Object.entries(state.deep_dive_feedbacks ?? {}).forEach(([module, feedback]) => {
    if (!feedback) {
      return;
    }

    timeline.push({
      id: `deep-dive-${module}`,
      label: "Deep Dive",
      title: feedback.title,
      summary: feedback.diagnosis,
      action: feedback.action
    });
  });

  return timeline;
}

export function getRecommendationFeedbackLabel(reaction: RecommendationFeedbackReaction) {
  if (reaction === "helpful") {
    return "도움됨";
  }

  if (reaction === "not_sure") {
    return "애매함";
  }

  return "나중에 다시 보기";
}
