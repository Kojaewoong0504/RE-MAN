"use client";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import type { DailyAgentResponse, OnboardingAgentResponse } from "@/lib/agents/contracts";
import { getFirebaseFirestoreInstance, hasFirebaseClientConfig } from "@/lib/firebase/client";
import type { OnboardingState } from "@/lib/onboarding/storage";

function getFirestore() {
  if (!hasFirebaseClientConfig()) {
    return null;
  }

  return getFirebaseFirestoreInstance();
}

export async function syncSurveyToFirestore(state: OnboardingState) {
  if (!state.user_id) {
    return;
  }

  const db = getFirestore();

  if (!db) {
    return;
  }

  await setDoc(
    doc(db, "users", state.user_id),
    {
      createdAt: serverTimestamp(),
      email: state.email ?? null,
      survey: state.survey
    },
    { merge: true }
  );
}

export async function saveOnboardingFeedbackToFirestore(
  state: OnboardingState,
  feedback: OnboardingAgentResponse
) {
  if (!state.user_id) {
    return;
  }

  const db = getFirestore();

  if (!db) {
    return;
  }

  await setDoc(doc(db, "users", state.user_id, "feedbacks", "1"), {
    day: 1,
    createdAt: serverTimestamp(),
    diagnosis: feedback.diagnosis,
    improvements: feedback.improvements,
    today_action: feedback.today_action,
    day1_mission: feedback.day1_mission
  });
}

export async function saveDailyFeedbackToFirestore(
  state: OnboardingState,
  day: number,
  feedback: DailyAgentResponse
) {
  if (!state.user_id || day < 2 || day > 7) {
    return;
  }

  const db = getFirestore();

  if (!db) {
    return;
  }

  await setDoc(doc(db, "users", state.user_id, "feedbacks", String(day)), {
    day,
    createdAt: serverTimestamp(),
    diagnosis: feedback.diagnosis,
    improvements: feedback.improvements,
    today_action: feedback.today_action,
    tomorrow_preview: feedback.tomorrow_preview
  });
}

export async function runFirebaseSmokeWrite(userId: string) {
  const db = getFirestore();

  if (!db) {
    throw new Error("missing_firebase_client_config");
  }

  const path = `users/${userId}`;

  await setDoc(
    doc(db, path),
    {
      debug_last_checked_at: serverTimestamp(),
      debug_last_source: "local-dev-page",
      debug_ok: true
    },
    { merge: true }
  );

  return path;
}
