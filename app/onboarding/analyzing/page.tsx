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

export default function AnalyzingPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function runAnalysis() {
      const state = readOnboardingState();
      const payload = buildOnboardingRequest(state);

      if (!payload) {
        router.replace("/programs/style/onboarding/upload");
        return;
      }

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json().catch(() => null)) as
        | OnboardingAgentResponse
        | { fallback_message?: string }
        | null;

      if (!isMounted) {
        return;
      }

      if (!response.ok || !data || "diagnosis" in data === false) {
        const fallback =
          data && "fallback_message" in data && typeof data.fallback_message === "string"
            ? data.fallback_message
            : "피드백을 가져오지 못했습니다. 다시 시도해 주세요.";

        patchOnboardingState({ feedback: undefined, fallback_message: fallback });
        setErrorMessage(fallback);
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
    };
  }, [router]);

  return (
    <main className="app-shell flex min-h-screen flex-col justify-center gap-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.28em] text-accent">Analyzing</p>
        <h1 className="text-4xl font-bold tracking-[-0.04em]">
          AI가 지금 스타일의 출발점을 읽고 있어요
        </h1>
      </div>
      <div className="grid gap-3">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`rounded-xl px-4 py-4 text-base ${
              index === steps.length - 1 ? "bg-accent text-black" : "bg-surface text-white"
            }`}
          >
            {step}
          </div>
        ))}
      </div>
      {errorMessage ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-surface p-5">
          <p className="text-sm leading-6 text-zinc-200">{errorMessage}</p>
          <button
            className="text-sm text-accent underline underline-offset-4"
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
