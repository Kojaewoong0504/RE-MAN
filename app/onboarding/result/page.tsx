"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";
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

    router.replace("/programs/style/onboarding/upload");
  }, [router]);

  return (
    <main className="app-shell space-y-8">
      <div className="space-y-6 pt-6">
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <button
              className="text-lg"
              onClick={() => router.push("/programs/style/onboarding/upload")}
              type="button"
            >
              ←
            </button>
            <p className="text-sm font-black tracking-tight text-ink">RE:MAN</p>
          </div>
          <AccountAccessButton />
        </div>
        <div className="space-y-3">
          <p className="poster-kicker">First Feedback</p>
          <h1 className="max-w-sm text-[40px] font-black leading-[1.03] tracking-[-0.05em] text-ink">
          첫 피드백은 칭찬보다 방향을 먼저 줍니다
          </h1>
          <p className="max-w-sm text-[17px] font-medium leading-7 text-muted">
            지금 보이는 인상에서 무엇을 먼저 바꿔야 하는지, 그리고 오늘 바로 할 수 있는
            행동 하나를 먼저 정리합니다.
          </p>
        </div>
      </div>
      {feedback ? (
        <div className="space-y-6">
          <section className="border-2 border-black bg-accent p-5">
            <p className="poster-kicker text-black/70">Outcome</p>
            <p className="mt-2 text-[18px] font-black leading-7 tracking-tight text-black">
              Day 1에서는 완벽한 답보다, 오늘 바꿀 수 있는 한 가지를 찾는 데 집중합니다.
            </p>
          </section>
          <FeedbackFlow
            closingLabel="Day 1 미션"
            diagnosis={feedback.diagnosis}
            improvements={feedback.improvements}
            todayAction={feedback.today_action}
          />
        </div>
      ) : (
        <div className="border-2 border-black bg-[#fcf8ef] p-6">
          <p className="text-sm leading-6 text-ink">
            {fallbackMessage ?? "피드백을 찾지 못했습니다. 다시 시도해 주세요."}
          </p>
        </div>
      )}
      <BottomCTA href="/programs/style/day/1" label="Day 1 미션 시작하기" />
    </main>
  );
}
