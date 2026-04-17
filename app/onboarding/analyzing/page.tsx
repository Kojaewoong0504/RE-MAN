"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingAgentResponse } from "@/lib/agents/contracts";
import { fetchAuthSession } from "@/lib/auth/client";
import { saveOnboardingFeedbackToFirestore } from "@/lib/firebase/firestore";
import {
  buildOnboardingRequest,
  patchOnboardingState,
  readOnboardingState,
  syncHistoryFromState
} from "@/lib/onboarding/storage";

const steps = ["핏을 분석하는 중...", "컬러 밸런스 확인 중...", "개선 포인트 정리 중..."];
const RATE_LIMIT_MESSAGE =
  "요청이 너무 빠르게 반복됐습니다. 잠시 후 다시 시도해 주세요.";
const AUTH_REQUIRED_MESSAGE =
  "로그인이 필요합니다. 다시 로그인한 뒤 스타일 체크를 이어가 주세요.";
const CREDIT_REQUIRED_MESSAGE =
  "스타일 체크에 필요한 크레딧이 부족합니다. 충전 기능은 준비 중입니다.";
type FeedbackErrorPayload = {
  fallback_message?: string;
  detail?: string;
  error?: string;
  message?: string;
};
type AnalysisError = {
  message: string;
  action: "login" | "retry" | "upload";
};

type FeedbackRequestPayload = NonNullable<ReturnType<typeof buildOnboardingRequest>>;

function getRetryAfterSeconds(response: Response) {
  const retryAfter = Number(response.headers.get("Retry-After"));
  return Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : null;
}

function buildStableHash(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function getImageFingerprint(image?: string) {
  if (!image) {
    return null;
  }

  return {
    length: image.length,
    start: image.slice(0, 80),
    end: image.slice(-80)
  };
}

function buildFeedbackIdempotencyKey(payload: FeedbackRequestPayload) {
  const stablePayload = {
    survey: payload.survey,
    closet_profile: payload.closet_profile,
    closet_items: payload.closet_items?.map((item) => ({
      id: item.id,
      category: item.category,
      name: item.name,
      color: item.color,
      fit: item.fit,
      size: item.size,
      wear_state: item.wear_state,
      wear_frequency: item.wear_frequency,
      season: item.season,
      condition: item.condition
    })),
    text_description: payload.text_description,
    image: getImageFingerprint(payload.image)
  };

  return `style-feedback:${buildStableHash(JSON.stringify(stablePayload))}`;
}

function buildAnalysisErrorMessage(
  response: Response,
  data: FeedbackErrorPayload | null
): AnalysisError {
  if (response.status === 401 || data?.error?.includes("access_token")) {
    return {
      message: AUTH_REQUIRED_MESSAGE,
      action: "login"
    };
  }

  if (response.status === 402 || data?.error === "insufficient_credits") {
    return {
      message:
        typeof data?.message === "string" && data.message.trim()
          ? data.message
          : CREDIT_REQUIRED_MESSAGE,
      action: "upload"
    };
  }

  if (response.status === 429 || data?.error === "rate_limited") {
    const retryAfter = getRetryAfterSeconds(response);
    return {
      message: retryAfter
        ? `${RATE_LIMIT_MESSAGE} 약 ${retryAfter}초 뒤 다시 시도할 수 있습니다.`
        : RATE_LIMIT_MESSAGE,
      action: "upload"
    };
  }

  const fallback =
    data && "fallback_message" in data && typeof data.fallback_message === "string"
      ? data.fallback_message
      : "피드백을 가져오지 못했습니다. 다시 시도해 주세요.";
  const detail = data && "detail" in data && typeof data.detail === "string" ? data.detail : "";

  return {
    message:
      process.env.NODE_ENV === "development" && detail
        ? `${fallback} [dev detail: ${detail}]`
        : fallback,
    action: "upload"
  };
}

async function postFeedback(payload: FeedbackRequestPayload, signal: AbortSignal) {
  return fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": buildFeedbackIdempotencyKey(payload)
    },
    body: JSON.stringify(payload),
    signal
  });
}

export default function AnalyzingPage() {
  const router = useRouter();
  const [errorState, setErrorState] = useState<AnalysisError | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function runAnalysis() {
      const state = readOnboardingState();
      const payload = buildOnboardingRequest(state);

      if (!payload) {
        router.replace("/programs/style/onboarding/upload");
        return;
      }

      const session = await fetchAuthSession();

      if (!session) {
        const authError = {
          message: AUTH_REQUIRED_MESSAGE,
          action: "login" as const
        };
        patchOnboardingState({ feedback: undefined, fallback_message: authError.message });
        setErrorState(authError);
        return;
      }

      let response: Response;

      try {
        response = await postFeedback(payload, controller.signal);

        if (response.status === 401) {
          const refreshedSession = await fetchAuthSession();

          if (refreshedSession) {
            response = await postFeedback(payload, controller.signal);
          }
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        throw error;
      }

      const data = (await response.json().catch(() => null)) as
        | OnboardingAgentResponse
        | { fallback_message?: string; detail?: string; error?: string }
        | null;

      if (!isMounted) {
        return;
      }

      if (!response.ok || !data || "diagnosis" in data === false) {
        const errorPayload =
          data && typeof data === "object" && !("diagnosis" in data)
            ? (data as FeedbackErrorPayload)
            : null;
        const nextError = buildAnalysisErrorMessage(response, errorPayload);

        patchOnboardingState({ feedback: undefined, fallback_message: nextError.message });
        setErrorState(nextError);
        return;
      }

      const nextState = patchOnboardingState({
        feedback: data,
        daily_feedbacks: {},
        fallback_message: undefined
      });
      const syncedState = syncHistoryFromState(nextState);
      void saveOnboardingFeedbackToFirestore(syncedState, data);
      router.replace("/programs/style/onboarding/result");
    }

    void runAnalysis();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [router]);

  return (
    <main className="app-shell flex min-h-screen flex-col justify-center gap-8">
      <div className="space-y-4">
        <p className="poster-kicker">Analyzing</p>
        <h1 className="text-4xl font-bold tracking-[-0.04em]">
          AI가 지금 스타일의 출발점을 읽고 있어요
        </h1>
      </div>
      <div className="grid gap-3">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`px-4 py-4 text-base font-bold ${
              index === steps.length - 1 ? "ui-panel-accent" : "ui-panel-muted text-ink"
            }`}
          >
            {step}
          </div>
        ))}
      </div>
      {errorState ? (
        <div className="ui-panel-muted space-y-4">
          <p className="text-sm leading-6 text-ink">{errorState.message}</p>
          <button
            className="text-sm font-black text-ink underline underline-offset-4"
            onClick={() => {
              if (errorState.action === "login") {
                router.replace("/login?returnTo=/programs/style/onboarding/analyzing");
                return;
              }

              router.replace("/programs/style/onboarding/upload");
            }}
            type="button"
          >
            {errorState.action === "login" ? "로그인하러 가기" : "텍스트 설명 다시 입력하기"}
          </button>
        </div>
      ) : null}
    </main>
  );
}
