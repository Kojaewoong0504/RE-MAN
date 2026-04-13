"use client";

import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import type { DailyAgentResponse, OnboardingAgentResponse } from "@/lib/agents/contracts";
import { getFirebaseFirestoreInstance, hasFirebaseClientConfig } from "@/lib/firebase/client";
import { buildHistoryFromState, type OnboardingState } from "@/lib/onboarding/storage";
import type { SurveyInput } from "@/lib/agents/contracts";

export type UserProfileDocument = {
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  bio?: string | null;
  preferredProgram?: string | null;
  survey?: Partial<SurveyInput> | null;
};

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

export async function syncAuthenticatedProfileToFirestore(input: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}) {
  const db = getFirestore();

  if (!db) {
    return;
  }

  await setDoc(
    doc(db, "users", input.uid),
    {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      email: input.email ?? null,
      displayName: input.displayName ?? null,
      photoURL: input.photoURL ?? null,
      provider: "google"
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

export async function readCurrentUserProfile(userId: string) {
  const db = getFirestore();

  if (!db) {
    throw new Error("missing_firebase_client_config");
  }

  const snapshot = await getDoc(doc(db, "users", userId));

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as UserProfileDocument;
}

export async function updateCurrentUserProfile(
  userId: string,
  profile: Pick<UserProfileDocument, "displayName" | "bio" | "preferredProgram">
) {
  const db = getFirestore();

  if (!db) {
    throw new Error("missing_firebase_client_config");
  }

  await setDoc(
    doc(db, "users", userId),
    {
      updatedAt: serverTimestamp(),
      displayName: profile.displayName ?? null,
      bio: profile.bio ?? null,
      preferredProgram: profile.preferredProgram ?? null
    },
    { merge: true }
  );
}

function parseSurvey(input: UserProfileDocument | null): SurveyInput {
  const survey = input?.survey ?? {};

  return {
    current_style: typeof survey.current_style === "string" ? survey.current_style : "",
    motivation: typeof survey.motivation === "string" ? survey.motivation : "",
    budget: typeof survey.budget === "string" ? survey.budget : ""
  };
}

function parseFeedbackDoc(day: number, data: Record<string, unknown>) {
  const improvements = Array.isArray(data.improvements)
    ? data.improvements.filter((item): item is string => typeof item === "string")
    : [];

  if (improvements.length !== 3) {
    return null;
  }

  const common = {
    diagnosis: typeof data.diagnosis === "string" ? data.diagnosis : "",
    improvements: [improvements[0], improvements[1], improvements[2]] as [string, string, string],
    today_action: typeof data.today_action === "string" ? data.today_action : ""
  };

  if (!common.diagnosis || !common.today_action) {
    return null;
  }

  if (day === 1) {
    const day1_mission = typeof data.day1_mission === "string" ? data.day1_mission : "";

    if (!day1_mission) {
      return null;
    }

    return {
      day,
      feedback: {
        ...common,
        day1_mission
      } satisfies OnboardingAgentResponse
    };
  }

  const tomorrow_preview =
    typeof data.tomorrow_preview === "string" ? data.tomorrow_preview : "";

  if (!tomorrow_preview) {
    return null;
  }

  return {
    day,
    feedback: {
      ...common,
      tomorrow_preview
    } satisfies DailyAgentResponse
  };
}

export async function readStyleProgramStateFromFirestore(userId: string) {
  const db = getFirestore();

  if (!db) {
    return null;
  }

  const userSnapshot = await getDoc(doc(db, "users", userId));
  const userProfile = userSnapshot.exists()
    ? (userSnapshot.data() as UserProfileDocument)
    : null;
  const feedbackSnapshot = await getDocs(collection(db, "users", userId, "feedbacks"));
  const state: OnboardingState = {
    user_id: userId,
    email: userProfile?.email ?? undefined,
    survey: parseSurvey(userProfile),
    daily_feedbacks: {}
  };

  feedbackSnapshot.docs.forEach((feedbackDoc) => {
    const day = Number(feedbackDoc.id);

    if (!Number.isFinite(day)) {
      return;
    }

    const parsed = parseFeedbackDoc(day, feedbackDoc.data());

    if (!parsed) {
      return;
    }

    if (parsed.day === 1) {
      state.feedback = parsed.feedback as OnboardingAgentResponse;
      return;
    }

    state.daily_feedbacks = {
      ...(state.daily_feedbacks ?? {}),
      [String(parsed.day)]: parsed.feedback as DailyAgentResponse
    };
  });

  return {
    ...state,
    feedback_history: buildHistoryFromState(state)
  };
}
