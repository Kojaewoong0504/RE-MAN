"use client";

import {
  mergePersistedProgramState,
  type OnboardingState
} from "@/lib/onboarding/storage";

export function resolveResultPageState(
  localState: OnboardingState,
  persistedState: OnboardingState | null
) {
  if (!persistedState?.user_id) {
    return localState;
  }

  return mergePersistedProgramState(localState, persistedState);
}
