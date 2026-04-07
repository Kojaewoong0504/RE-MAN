"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomCTA } from "@/components/common/BottomCTA";
import { FeedbackFlow } from "@/components/feedback/FeedbackFlow";
import type { OnboardingAgentResponse } from "@/lib/agents/contracts";
import { readOnboardingState } from "@/lib/onboarding/storage";

export default function ResultPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<OnboardingAgentResponse | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  useEffect(() => {
    const state = readOnboardingState();

    if (state.feedback) {
      setFeedback(state.feedback);
      return;
    }

    if (state.fallback_message) {
      setFallbackMessage(state.fallback_message);
      return;
    }

    router.replace("/onboarding/upload");
  }, [router]);

  return (
    <main className="app-shell space-y-8">
      <div className="space-y-4 pt-8">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">First Feedback</p>
        <h1 className="text-4xl font-bold tracking-[-0.04em]">
          첫 피드백은 칭찬보다 방향을 먼저 줍니다
        </h1>
      </div>
      {feedback ? (
        <FeedbackFlow
          closingLabel="Day 1 미션"
          diagnosis={feedback.diagnosis}
          improvements={feedback.improvements}
          todayAction={feedback.today_action}
        />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-surface p-6">
          <p className="text-sm leading-6 text-zinc-200">
            {fallbackMessage ?? "피드백을 찾지 못했습니다. 다시 시도해 주세요."}
          </p>
        </div>
      )}
      <BottomCTA href="/day/1" label="Day 1 미션 시작하기" />
    </main>
  );
}
