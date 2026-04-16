"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingAgentResponse } from "@/lib/agents/contracts";
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
type FeedbackErrorPayload = { fallback_message?: string; detail?: string; error?: string };

function getRetryAfterSeconds(response: Response) {
  const retryAfter = Number(response.headers.get("Retry-After"));
  return Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : null;
}

function buildAnalysisErrorMessage(
  response: Response,
  data: FeedbackErrorPayload | null
) {
  if (response.status === 429 || data?.error === "rate_limited") {
    const retryAfter = getRetryAfterSeconds(response);
    return retryAfter
      ? `${RATE_LIMIT_MESSAGE} 약 ${retryAfter}초 뒤 다시 시도할 수 있습니다.`
      : RATE_LIMIT_MESSAGE;
  }

  const fallback =
    data && "fallback_message" in data && typeof data.fallback_message === "string"
      ? data.fallback_message
      : "피드백을 가져오지 못했습니다. 다시 시도해 주세요.";
  const detail = data && "detail" in data && typeof data.detail === "string" ? data.detail : "";

  return process.env.NODE_ENV === "development" && detail
    ? `${fallback} [dev detail: ${detail}]`
    : fallback;
}

export default function AnalyzingPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      let response: Response;

      try {
        response = await fetch("/api/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
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
        const visibleMessage = buildAnalysisErrorMessage(response, errorPayload);

        patchOnboardingState({ feedback: undefined, fallback_message: visibleMessage });
        setErrorMessage(visibleMessage);
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
      {errorMessage ? (
        <div className="ui-panel-muted space-y-4">
          <p className="text-sm leading-6 text-ink">{errorMessage}</p>
          <button
            className="text-sm font-black text-ink underline underline-offset-4"
            onClick={() => router.replace("/programs/style/onboarding/upload")}
            type="button"
          >
            텍스트 설명 다시 입력하기
          </button>
        </div>
      ) : null}
    </main>
  );
}
