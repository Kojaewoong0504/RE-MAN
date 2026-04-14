"use client";

import type {
  AgentRequest,
  ClosetProfile,
  DailyAgentResponse,
  FeedbackHistoryItem,
  OnboardingAgentResponse,
  SurveyInput
} from "@/lib/agents/contracts";

const ONBOARDING_STORAGE_KEY = "reman:onboarding";
const HISTORY_SUMMARY_MAX_LENGTH = 64;

export type OnboardingInput = {
  survey: SurveyInput;
  closet_profile?: ClosetProfile;
  image?: string;
  text_description?: string;
};

export type OnboardingState = OnboardingInput & {
  user_id?: string;
  email?: string;
  feedback?: OnboardingAgentResponse;
  daily_feedbacks?: Record<string, DailyAgentResponse>;
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
      user_id: parsed.user_id,
      email: parsed.email,
      image: parsed.image,
      text_description: parsed.text_description,
      feedback: parsed.feedback,
      daily_feedbacks: parsed.daily_feedbacks ?? {},
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
    }
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
  const { survey, closet_profile, image, text_description, user_id } = state;

  if (
    !survey.current_style.trim() ||
    !survey.motivation.trim() ||
    !survey.budget.trim() ||
    (!image && !text_description)
  ) {
    return null;
  }

  return {
    user_id,
    survey,
    closet_profile: getClosetProfileOrUndefined(closet_profile),
    image,
    text_description,
    feedback_history: []
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
    feedback: shouldPreferPersistedProgram ? persisted.feedback : current.feedback ?? persisted.feedback,
    daily_feedbacks: shouldPreferPersistedProgram
      ? persisted.daily_feedbacks ?? {}
      : {
          ...(persisted.daily_feedbacks ?? {}),
          ...(current.daily_feedbacks ?? {})
        },
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
      entryPath,
      primaryLabel: "최근 스타일 체크 보기",
      secondaryLabel: "프로그램 보기",
      summaryLabel: "Current Program",
      summaryBody: "최근 스타일 체크 결과가 저장되어 있습니다. 필요하면 같은 결과에서 추가 체크를 이어갈 수 있습니다."
    };
  }

  return {
    status,
    entryPath: "/programs/style/onboarding/result",
    primaryLabel: "최근 스타일 체크 보기",
    secondaryLabel: "다른 프로그램 보기",
    summaryLabel: "Completed Program",
    summaryBody: "루틴 기록이 있더라도 기본 복귀는 최근 스타일 체크 결과입니다. 새 체크나 다른 프로그램을 선택할 수 있습니다."
  };
}

export function buildDailyRequest(
  state: OnboardingState,
  day: number
): AgentRequest | null {
  const { survey, closet_profile, image, text_description, feedback_history = [], user_id } = state;

  if (
    day < 2 ||
    !survey.current_style.trim() ||
    !survey.motivation.trim() ||
    !survey.budget.trim() ||
    (!image && !text_description)
  ) {
    return null;
  }

  return {
    user_id,
    survey,
    closet_profile: getClosetProfileOrUndefined(closet_profile),
    image,
    text_description,
    feedback_history
  };
}

export function buildHistoryFromState(state: OnboardingState) {
  const nextHistory: FeedbackHistoryItem[] = [];

  if (state.feedback?.diagnosis) {
    nextHistory.push({
      day: 1,
      summary: buildHistorySummary(state.feedback.diagnosis),
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
