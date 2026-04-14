"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";
import { BottomCTA } from "@/components/common/BottomCTA";
import { TryOnPreview } from "@/components/try-on/TryOnPreview";
import type {
  DeepDiveModule,
  DeepDiveResponse,
  OnboardingAgentResponse
} from "@/lib/agents/contracts";
import {
  buildOnboardingRequest,
  patchOnboardingState,
  readOnboardingState
} from "@/lib/onboarding/storage";

const resultActions = [
  {
    id: "fit",
    label: "핏 더 보기",
    description: "기장, 실루엣, 상하의 비율을 따로 확인합니다."
  },
  {
    id: "color",
    label: "색 조합 보기",
    description: "지금 조합의 색 균형과 덜 튀는 대안을 확인합니다."
  },
  {
    id: "occasion",
    label: "상황별 코디",
    description: "소개팅, 출근, 주말 같은 목적에 맞춰 다시 봅니다."
  },
  {
    id: "closet",
    label: "내 옷장 다른 조합",
    description: "입력한 상의, 하의, 신발 안에서 다른 조합을 찾습니다."
  }
] as const satisfies ReadonlyArray<{
  id: DeepDiveModule;
  label: string;
  description: string;
}>;

const moduleKickers: Record<DeepDiveModule, string> = {
  fit: "Fit Check",
  color: "Color Check",
  occasion: "Occasion Check",
  closet: "Closet Remix"
};

export default function ResultPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<OnboardingAgentResponse | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [personImage, setPersonImage] = useState<string | undefined>();
  const [selectedResultAction, setSelectedResultAction] = useState<
    (typeof resultActions)[number] | null
  >(null);
  const [deepDiveFeedback, setDeepDiveFeedback] = useState<DeepDiveResponse | null>(null);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);

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

  function handleStartNewCheck() {
    patchOnboardingState({
      image: undefined,
      text_description: undefined,
      feedback: undefined,
      daily_feedbacks: {},
      feedback_history: [],
      fallback_message: undefined
    });
    router.push("/programs/style/onboarding/upload");
  }

  async function handleResultAction(action: (typeof resultActions)[number]) {
    setSelectedResultAction(action);
    setDeepDiveError(null);

    if (!feedback) {
      setDeepDiveFeedback(null);
      return;
    }

    const state = readOnboardingState();
    const basePayload = buildOnboardingRequest(state);

    if (!basePayload) {
      setDeepDiveError(`${action.label}를 만들기 위한 사진 또는 텍스트 설명을 찾지 못했습니다.`);
      setDeepDiveFeedback(null);
      return;
    }

    setIsDeepDiveLoading(true);
    setDeepDiveFeedback(null);

    try {
      const response = await fetch("/api/deep-dive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...basePayload,
          module: action.id,
          current_feedback: feedback
        })
      });
      const data = (await response.json().catch(() => null)) as
        | DeepDiveResponse
        | { fallback_message?: string }
        | null;

      if (!response.ok || !data || "title" in data === false) {
        setDeepDiveError(
          data && "fallback_message" in data && typeof data.fallback_message === "string"
            ? data.fallback_message
            : `${action.label}를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.`
        );
        return;
      }

      setDeepDiveFeedback(data);
    } finally {
      setIsDeepDiveLoading(false);
    }
  }

  return (
    <main className="app-shell space-y-7">
      <div className="space-y-5 pt-4">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <button
              className="app-back-button"
              onClick={() => router.push("/programs/style/onboarding/upload")}
              type="button"
            >
              ←
            </button>
            <p className="app-brand">RE:MAN</p>
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

          <section className="ui-panel-muted space-y-4">
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

          <section className="ui-panel-accent space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--color-accent-ink)]/70">
              Next Action
            </p>
            <h2 className="text-[26px] font-black leading-tight tracking-[-0.05em]">
              지금 바꿀 것은 하나만
            </h2>
            <p className="text-[16px] font-black leading-7">{feedback.today_action}</p>
          </section>

          <TryOnPreview
            personImage={personImage}
            prompt={feedback.recommended_outfit.try_on_prompt}
            recommendation={feedback.recommended_outfit}
          />

          <section className="ui-section">
            <div className="space-y-2">
              <p className="poster-kicker">Next Checks</p>
              <h2 className="text-[30px] font-black leading-[1.05] tracking-[-0.05em] text-ink">
                더 보고 싶은 것만 고르세요
              </h2>
              <p className="max-w-md text-[15px] font-semibold leading-7 text-muted">
                루틴을 따라가지 않아도 됩니다. 필요한 체크만 골라 이어가고, 원하면 새
                사진으로 다시 시작할 수 있습니다.
              </p>
            </div>
            <div className="grid gap-3">
              {resultActions.map((action) => {
                const selected = selectedResultAction?.id === action.id;

                return (
                  <button
                    key={action.id}
                    aria-pressed={selected}
                    className={`ui-choice ${selected ? "ui-choice-selected" : ""}`}
                    onClick={() => void handleResultAction(action)}
                    type="button"
                  >
                    <span className="block text-base font-black">{action.label}</span>
                    <span className="mt-2 block text-sm font-semibold leading-6 opacity-75">
                      {action.description}
                    </span>
                  </button>
                );
              })}
              <button
                className="ui-button-secondary justify-between py-4 text-left"
                onClick={handleStartNewCheck}
                type="button"
              >
                <span>새 스타일 체크 시작하기</span>
                <span>→</span>
              </button>
            </div>
            {isDeepDiveLoading ? (
              <div className="ui-panel-muted">
                <p className="text-sm font-bold leading-6 text-ink">
                  {selectedResultAction?.label ?? "추가 체크"}를 따로 읽고 있습니다.
                </p>
              </div>
            ) : null}
            {deepDiveFeedback ? (
              <div className="ui-panel-muted space-y-4">
                <div className="space-y-2">
                  <p className="poster-kicker">
                    {selectedResultAction ? moduleKickers[selectedResultAction.id] : "Deep Dive"}
                  </p>
                  <h3 className="text-[25px] font-black leading-tight tracking-[-0.04em] text-ink">
                    {deepDiveFeedback.title}
                  </h3>
                  <p className="text-sm font-bold leading-6 text-muted">
                    {deepDiveFeedback.diagnosis}
                  </p>
                </div>
                <div className="grid gap-3">
                  {deepDiveFeedback.focus_points.map((point) => (
                    <p key={point} className="border-t border-black/10 pt-3 text-sm font-semibold leading-6 text-ink">
                      {point}
                    </p>
                  ))}
                </div>
                <p className="text-sm font-bold leading-6 text-muted">
                  {deepDiveFeedback.recommendation}
                </p>
                <p className="border-t border-black/10 pt-3 text-sm font-black leading-6 text-ink">
                  {deepDiveFeedback.action}
                </p>
              </div>
            ) : null}
            {deepDiveError ? (
              <div className="ui-panel-muted">
                <p className="text-sm font-bold leading-6 text-red-700">{deepDiveError}</p>
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <div className="ui-panel">
          <p className="text-sm leading-6 text-ink">
            {fallbackMessage ?? "피드백을 찾지 못했습니다. 다시 시도해 주세요."}
          </p>
        </div>
      )}
      <div className="space-y-3 pb-24">
        <Link
          className="block text-center text-sm font-black text-muted underline underline-offset-4"
          href="/programs/style/day/1"
        >
          원하면 루틴 모드로 이어가기
        </Link>
        <BottomCTA href="/" label="결과 저장하고 홈으로" />
      </div>
    </main>
  );
}
