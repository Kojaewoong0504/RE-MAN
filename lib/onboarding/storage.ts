"use client";

import type {
  AgentRequest,
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
  feedback?: OnboardingAgentResponse;
  fallback_message?: string;
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
      image: parsed.image,
      text_description: parsed.text_description,
      feedback: parsed.feedback,
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
  const { survey, image, text_description } = state;

  if (
    !survey.current_style.trim() ||
    !survey.motivation.trim() ||
    !survey.budget.trim() ||
    (!image && !text_description)
  ) {
    return null;
  }

  return {
    survey,
    image,
    text_description,
    feedback_history: []
  };
}
