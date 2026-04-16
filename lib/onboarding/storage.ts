"use client";

import type {
  AgentRequest,
  ClosetProfile,
  DailyAgentResponse,
  DeepDiveModule,
  DeepDiveResponse,
  FeedbackHistoryItem,
  OnboardingAgentResponse,
  SurveyInput
} from "@/lib/agents/contracts";
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

function toAgentClosetItems(items: ClosetItem[] | undefined) {
  return normalizeClosetItems(items).map((item) => ({
    id: item.id,
    category: item.category,
    name: item.name,
    color: item.color,
    fit: item.fit,
    size: item.size,
    wear_state: item.wear_state,
    notes: item.notes
  }));
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
    image,
    text_description,
    feedback_history: state.feedback_history ?? []
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
    image,
    text_description,
    feedback_history
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
    timeline.push({
      id: "style-check",
      label: "Style Check",
      title: state.feedback.recommended_outfit.title,
      summary: recommendationFeedback
        ? `${state.feedback.diagnosis} / 내 반응: ${getRecommendationFeedbackLabel(recommendationFeedback.reaction)}`
        : state.feedback.diagnosis,
      action: state.feedback.today_action,
      basis: buildClosetBasisMatches({
        closetItems: normalizeClosetItems(state.closet_items),
        recommendedItems: state.feedback.recommended_outfit.items,
        sourceItemIds: state.feedback.recommended_outfit.source_item_ids
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
