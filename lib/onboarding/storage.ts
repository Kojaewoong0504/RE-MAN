"use client";

import type {
  AgentRequest,
  DailyAgentResponse,
  FeedbackHistoryItem,
  OnboardingAgentResponse,
  SurveyInput
} from "@/lib/agents/contracts";

const ONBOARDING_STORAGE_KEY = "reman:onboarding";

export type OnboardingInput = {
  survey: SurveyInput;
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
  budget: ""
};

function getEmptyState(): OnboardingState {
  return {
    survey: defaultSurvey
  };
}

function isStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function buildHistorySummary(summary: string, action?: string, nextFocus?: string) {
  const segments = [summary.trim()];

  if (action?.trim()) {
    segments.push(`실행: ${action.trim()}`);
  }

  if (nextFocus?.trim()) {
    segments.push(`다음 초점: ${nextFocus.trim()}`);
  }

  return segments.join(" / ");
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
  const { survey, image, text_description, user_id } = state;

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

  const latestDay = getLatestDailyDay(state);

  if (latestDay >= 7) {
    return "/programs/style/day/7";
  }

  if (latestDay === 1) {
    return "/programs/style/day/1";
  }

  return `/programs/style/day/${latestDay + 1}`;
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
    const latestDay = getLatestDailyDay(state);
    return {
      status,
      entryPath,
      primaryLabel: "스타일 이어서 하기",
      secondaryLabel: "프로그램 보기",
      summaryLabel: "Current Program",
      summaryBody: `스타일 프로그램 Day ${latestDay === 1 ? 1 : latestDay + 1} 진행 중`
    };
  }

  return {
    status,
    entryPath,
    primaryLabel: "스타일 완료 내용 보기",
    secondaryLabel: "다른 프로그램 보기",
    summaryLabel: "Completed Program",
    summaryBody: "스타일 7일 프로그램을 완료했습니다. 유지할 기준을 다시 보거나 다른 변화를 시작할 수 있습니다."
  };
}

export function buildDailyRequest(
  state: OnboardingState,
  day: number
): AgentRequest | null {
  const { survey, image, text_description, feedback_history = [], user_id } = state;

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
    image,
    text_description,
    feedback_history
  };
}

export function syncHistoryFromState(state: OnboardingState) {
  const nextHistory: FeedbackHistoryItem[] = [];

  if (state.feedback?.diagnosis) {
    nextHistory.push({
      day: 1,
      summary: buildHistorySummary(
        state.feedback.diagnosis,
        state.feedback.today_action,
        state.feedback.day1_mission
      ),
      action: state.feedback.today_action,
      next_focus: state.feedback.day1_mission
    });
  }

  const dailyEntries = Object.entries(state.daily_feedbacks ?? {})
    .map(([day, feedback]) => ({
      day: Number(day),
      summary: buildHistorySummary(
        feedback.diagnosis,
        feedback.today_action,
        feedback.tomorrow_preview
      ),
      action: feedback.today_action,
      next_focus: feedback.tomorrow_preview
    }))
    .filter((entry) => Number.isFinite(entry.day))
    .sort((left, right) => left.day - right.day);

  nextHistory.push(...dailyEntries);

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
    .map((item) => `Day ${item.day}: ${item.summary}`);
}
