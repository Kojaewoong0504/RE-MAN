"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";
import { BottomCTA } from "@/components/common/BottomCTA";
import { TryOnPreview } from "@/components/try-on/TryOnPreview";
import type { OnboardingAgentResponse } from "@/lib/agents/contracts";
import { readOnboardingState } from "@/lib/onboarding/storage";

export default function ResultPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<OnboardingAgentResponse | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [personImage, setPersonImage] = useState<string | undefined>();

  useEffect(() => {
    const state = readOnboardingState();

    if (state.feedback) {
      setFeedback(state.feedback);
      setPersonImage(state.image);
      return;
    }

    if (state.fallback_message) {
      setFallbackMessage(state.fallback_message);
      return;
    }

    router.replace("/programs/style/onboarding/upload");
  }, [router]);

  return (
    <main className="app-shell space-y-7">
      <div className="space-y-5 pt-4">
        <div className="flex items-center justify-between border-b border-black/15 pb-4">
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
          <p className="poster-kicker">Style Check Result</p>
          <h1 className="max-w-sm text-[40px] font-black leading-[1.03] tracking-[-0.05em] text-ink">
            지금 사진에서 시작점을 잡았습니다
          </h1>
          <p className="max-w-sm text-[17px] font-medium leading-7 text-muted">
            진단은 길게 설명하지 않습니다. 오늘 바꿀 한 가지와 바로 입어볼 조합을 먼저
            보여줍니다.
          </p>
        </div>
      </div>
      {feedback ? (
        <div className="space-y-7">
          <section className="overflow-hidden border border-black/15 bg-[#f7f0e3]">
            {personImage ? (
              <Image
                alt="분석 기준 전신 사진"
                className="aspect-[4/5] w-full object-cover"
                height={900}
                priority
                src={personImage}
                unoptimized
                width={720}
              />
            ) : (
              <div className="flex min-h-72 items-center justify-center px-8 text-center text-sm font-black leading-6 text-muted">
                텍스트 설명 기반 결과입니다. 실착 생성은 전신 사진이 있을 때 사용할 수 있습니다.
              </div>
            )}
          </section>

          <section className="space-y-4 border-t border-black/15 pt-6">
            <p className="poster-kicker">Diagnosis</p>
            <p className="text-[25px] font-black leading-[1.18] tracking-[-0.04em] text-ink">
              {feedback.diagnosis}
            </p>
          </section>

          <section className="space-y-4 border-t border-black/15 pt-6">
            <div className="space-y-1">
              <p className="poster-kicker">Change Points</p>
              <h2 className="text-[28px] font-black leading-tight tracking-[-0.05em] text-ink">
                오늘은 세 가지만 보면 됩니다
              </h2>
            </div>
            <div className="grid gap-4">
              {feedback.improvements.map((item, index) => (
                <div key={item} className="grid grid-cols-[44px_1fr] gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-sm font-black text-[#fcf8ef]">
                    {index + 1}
                  </div>
                  <p className="border-b border-black/10 pb-4 text-[16px] font-semibold leading-7 text-ink">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4 border-t border-black/15 bg-[#f4ecdd] px-5 py-6">
            <p className="poster-kicker">Recommended Outfit</p>
            <div className="space-y-3">
              <h2 className="text-[31px] font-black leading-[1.05] tracking-[-0.06em] text-ink">
                {feedback.recommended_outfit.title}
              </h2>
              <p className="text-[17px] font-black leading-7 text-ink">
                {feedback.recommended_outfit.items.join(" + ")}
              </p>
              <p className="text-[15px] font-semibold leading-7 text-muted">
                {feedback.recommended_outfit.reason}
              </p>
            </div>
          </section>

          <section className="space-y-3 border border-black bg-accent p-5 text-black">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-black/60">
              Day 1 Mission
            </p>
            <h2 className="text-[26px] font-black leading-tight tracking-[-0.05em]">
              오늘 할 일은 하나만
            </h2>
            <p className="text-[16px] font-black leading-7">{feedback.today_action}</p>
          </section>

          <TryOnPreview
            personImage={personImage}
            prompt={feedback.recommended_outfit.try_on_prompt}
            recommendation={feedback.recommended_outfit}
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
