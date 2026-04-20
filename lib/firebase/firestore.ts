"use client";

import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import type {
  ClosetProfile,
  DailyAgentResponse,
  DeepDiveModule,
  DeepDiveResponse,
  OnboardingAgentResponse
} from "@/lib/agents/contracts";
import { getFirebaseFirestoreInstance, hasFirebaseClientConfig } from "@/lib/firebase/client";
import {
  buildHistoryFromState,
  normalizeRecommendationFeedback,
  normalizeSizeProfile,
  normalizeClosetItems,
  type ClosetItem,
  type OnboardingState,
  type RecommendationFeedback,
  type SizeProfile
} from "@/lib/onboarding/storage";
import type { SurveyInput } from "@/lib/agents/contracts";

export type UserProfileDocument = {
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  bio?: string | null;
  preferredProgram?: string | null;
  survey?: Partial<SurveyInput> | null;
  closet_profile?: Partial<ClosetProfile> | null;
  closet_items?: ClosetItem[] | null;
  size_profile?: SizeProfile | null;
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
      updatedAt: serverTimestamp(),
      email: state.email ?? null,
      survey: state.survey,
      closet_profile: state.closet_profile ?? null,
      closet_items: normalizeClosetItems(state.closet_items),
      size_profile: normalizeSizeProfile(state.size_profile)
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
    recommended_outfit: feedback.recommended_outfit,
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

export async function saveDeepDiveFeedbackToFirestore(
  state: OnboardingState,
  module: DeepDiveModule,
  feedback: DeepDiveResponse
) {
  if (!state.user_id) {
    return;
  }

  const db = getFirestore();

  if (!db) {
    return;
  }

  await setDoc(doc(db, "users", state.user_id, "deepDives", module), {
    module,
    createdAt: serverTimestamp(),
    title: feedback.title,
    diagnosis: feedback.diagnosis,
    focus_points: feedback.focus_points,
    recommendation: feedback.recommendation,
    action: feedback.action
  });
}

export async function saveRecommendationFeedbackToFirestore(
  state: OnboardingState,
  feedback: RecommendationFeedback
) {
  if (!state.user_id) {
    return;
  }

  const db = getFirestore();

  if (!db) {
    return;
  }

  await setDoc(doc(db, "users", state.user_id, "recommendationFeedbacks", "style-check"), {
    ...feedback,
    updatedAt: serverTimestamp()
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
  profile: Pick<
    UserProfileDocument,
    "displayName" | "bio" | "preferredProgram" | "survey" | "closet_profile" | "closet_items"
  > & { size_profile?: SizeProfile }
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
      preferredProgram: profile.preferredProgram ?? null,
      ...(profile.survey ? { survey: profile.survey } : {}),
      ...(profile.closet_profile ? { closet_profile: profile.closet_profile } : {}),
      closet_items: normalizeClosetItems(profile.closet_items),
      size_profile: normalizeSizeProfile(profile.size_profile)
    },
    { merge: true }
  );
}

export async function syncClosetItemsToServer(input: {
  items: ClosetItem[];
  closet_profile?: Partial<ClosetProfile> | null;
  size_profile?: SizeProfile | null;
}) {
  const response = await fetch("/api/closet/items", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const body = (await response.json().catch(() => null)) as
    | {
        closet_items?: ClosetItem[];
        closet_profile?: ClosetProfile;
        error?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(body?.error ?? "closet_sync_failed");
  }

  return {
    closet_items: normalizeClosetItems(body?.closet_items),
    closet_profile: body?.closet_profile
  };
}

function parseSurvey(input: UserProfileDocument | null): SurveyInput {
  const survey = input?.survey ?? {};

  return {
    current_style: typeof survey.current_style === "string" ? survey.current_style : "",
    motivation: typeof survey.motivation === "string" ? survey.motivation : "",
    budget: typeof survey.budget === "string" ? survey.budget : "",
    style_goal: typeof survey.style_goal === "string" ? survey.style_goal : "",
    confidence_level:
      typeof survey.confidence_level === "string" ? survey.confidence_level : ""
  };
}

function parseClosetProfile(input: UserProfileDocument | null): ClosetProfile | undefined {
  const closet = input?.closet_profile ?? {};
  const profile: ClosetProfile = {
    tops: typeof closet.tops === "string" ? closet.tops : "",
    bottoms: typeof closet.bottoms === "string" ? closet.bottoms : "",
    shoes: typeof closet.shoes === "string" ? closet.shoes : "",
    outerwear: typeof closet.outerwear === "string" ? closet.outerwear : "",
    avoid: typeof closet.avoid === "string" ? closet.avoid : ""
  };

  if (!Object.values(profile).some((value) => value.trim())) {
    return undefined;
  }

  return profile;
}

function parseRecommendedOutfit(data: Record<string, unknown>) {
  const raw = data.recommended_outfit;

  if (!raw || typeof raw !== "object") {
    return {
      title: "기존 피드백 기반 기본 추천 조합",
      items: ["가장 깔끔한 상의", "주름이 적은 바지", "톤이 맞는 신발"] as [
        string,
        string,
        string
      ],
      reason: "기존 저장 데이터에 추천 조합이 없어 기본 조합으로 복원했습니다.",
      try_on_prompt: "전신 정면 사진을 기준으로 깔끔한 상의, 바지, 신발 조합을 자연스럽게 착용한 미리보기",
      source_item_ids: undefined
    };
  }

  const recommendation = raw as Record<string, unknown>;
  const items = Array.isArray(recommendation.items)
    ? recommendation.items.filter((item): item is string => typeof item === "string")
    : [];

  if (
    typeof recommendation.title !== "string" ||
    typeof recommendation.reason !== "string" ||
    typeof recommendation.try_on_prompt !== "string" ||
    items.length !== 3
  ) {
    return {
      title: "기존 피드백 기반 기본 추천 조합",
      items: ["가장 깔끔한 상의", "주름이 적은 바지", "톤이 맞는 신발"] as [
        string,
        string,
        string
      ],
      reason: "기존 저장 데이터의 추천 조합 형식이 맞지 않아 기본 조합으로 복원했습니다.",
      try_on_prompt: "전신 정면 사진을 기준으로 깔끔한 상의, 바지, 신발 조합을 자연스럽게 착용한 미리보기",
      source_item_ids: undefined
    };
  }

  const sourceItemIds =
    recommendation.source_item_ids &&
    typeof recommendation.source_item_ids === "object" &&
    !Array.isArray(recommendation.source_item_ids)
      ? (recommendation.source_item_ids as Record<string, unknown>)
      : null;

  return {
    title: recommendation.title,
    items: [items[0], items[1], items[2]] as [string, string, string],
    reason: recommendation.reason,
    try_on_prompt: recommendation.try_on_prompt,
    source_item_ids: sourceItemIds
      ? (["tops", "bottoms", "shoes", "outerwear"] as const).reduce<Record<string, string>>(
          (acc, category) => {
            const itemId = sourceItemIds[category];

            if (typeof itemId === "string" && itemId.trim()) {
              acc[category] = itemId.trim();
            }

            return acc;
          },
          {}
        )
      : undefined
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
    const recommended_outfit = parseRecommendedOutfit(data);

    if (!day1_mission || !recommended_outfit) {
      return null;
    }

    return {
      day,
      feedback: {
        ...common,
        recommended_outfit,
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

function isDeepDiveModule(value: string): value is DeepDiveModule {
  return value === "fit" || value === "color" || value === "occasion" || value === "closet";
}

function parseDeepDiveDoc(module: string, data: Record<string, unknown>) {
  const focusPoints = Array.isArray(data.focus_points)
    ? data.focus_points.filter((item): item is string => typeof item === "string")
    : [];

  if (
    !isDeepDiveModule(module) ||
    typeof data.title !== "string" ||
    typeof data.diagnosis !== "string" ||
    focusPoints.length !== 3 ||
    typeof data.recommendation !== "string" ||
    typeof data.action !== "string"
  ) {
    return null;
  }

  return {
    module,
    feedback: {
      title: data.title,
      diagnosis: data.diagnosis,
      focus_points: [focusPoints[0], focusPoints[1], focusPoints[2]] as [
        string,
        string,
        string
      ],
      recommendation: data.recommendation,
      action: data.action
    } satisfies DeepDiveResponse
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
  const deepDiveSnapshot = await getDocs(collection(db, "users", userId, "deepDives"));
  const recommendationFeedbackSnapshot = await getDoc(
    doc(db, "users", userId, "recommendationFeedbacks", "style-check")
  );
  const state: OnboardingState = {
    user_id: userId,
    email: userProfile?.email ?? undefined,
    survey: parseSurvey(userProfile),
    closet_profile: parseClosetProfile(userProfile),
    closet_items: normalizeClosetItems(userProfile?.closet_items),
    size_profile: normalizeSizeProfile(userProfile?.size_profile),
    daily_feedbacks: {},
    deep_dive_feedbacks: {},
    recommendation_feedback: recommendationFeedbackSnapshot.exists()
      ? normalizeRecommendationFeedback(recommendationFeedbackSnapshot.data())
      : undefined
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

  deepDiveSnapshot.docs.forEach((deepDiveDoc) => {
    const parsed = parseDeepDiveDoc(deepDiveDoc.id, deepDiveDoc.data());

    if (!parsed) {
      return;
    }

    state.deep_dive_feedbacks = {
      ...(state.deep_dive_feedbacks ?? {}),
      [parsed.module]: parsed.feedback
    };
  });

  return {
    ...state,
    feedback_history: buildHistoryFromState(state)
  };
}
