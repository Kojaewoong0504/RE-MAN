"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditStatus } from "@/components/credits/CreditStatus";
import type { OnboardingAgentResponse } from "@/lib/agents/contracts";
import { fetchAuthSession } from "@/lib/auth/client";
import type { AuthUser } from "@/lib/auth/types";
import { saveRecommendationFeedbackToFirestore } from "@/lib/firebase/firestore";
import {
  buildClosetStrategy,
  buildHistoryFromState,
  buildRecommendationFeedbackMemory,
  getRecommendationFeedbackLabel,
  normalizeClosetItems,
  patchOnboardingState,
  readOnboardingState,
  syncHistoryFromState,
  type RecommendationFeedbackReaction
} from "@/lib/onboarding/storage";
import {
  buildClosetBasisMatches,
  buildClosetBasisSummary,
  type ClosetBasisItem
} from "@/lib/product/closet-basis";
import { buildTodayActionPlan } from "@/lib/product/today-action-plan";

type RecommendationFeedbackStatus = "idle" | "saving" | "saved" | "error";

const recommendationReactionOptions: Array<{
  reaction: RecommendationFeedbackReaction;
  label: string;
  description: string;
}> = [
  {
    reaction: "helpful",
    label: "도움됨",
    description: "더 추천"
  },
  {
    reaction: "not_sure",
    label: "애매함",
    description: "보류"
  },
  {
    reaction: "save_for_later",
    label: "나중에 보기",
    description: "저장"
  }
];

function compactUiText(value: string, maxLength = 58) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function buildResultClosetBasis(
  closetItems: ReturnType<typeof normalizeClosetItems>,
  feedback: OnboardingAgentResponse
) {
  return buildClosetBasisMatches({
    closetItems,
    recommendedItems: feedback.recommended_outfit.items,
    sourceItemIds: feedback.recommended_outfit.source_item_ids,
    strategyItems: buildClosetStrategy(closetItems)?.items
  });
}

export default function ResultPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<OnboardingAgentResponse | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [personImage, setPersonImage] = useState<string | undefined>();
  const [accountUser, setAccountUser] = useState<AuthUser | null>(null);
  const [selectedReaction, setSelectedReaction] =
    useState<RecommendationFeedbackReaction | null>(null);
  const [recommendationNote, setRecommendationNote] = useState("");
  const [recommendationFeedbackStatus, setRecommendationFeedbackStatus] =
    useState<RecommendationFeedbackStatus>("idle");
  const [closetBasis, setClosetBasis] = useState<ClosetBasisItem[]>([]);
  const todayPlan = feedback
    ? buildTodayActionPlan({
        todayAction: feedback.today_action,
        recommendedItems: feedback.recommended_outfit.items
      })
    : null;
  const closetBasisSummary = buildClosetBasisSummary(closetBasis);

  useEffect(() => {
    const state = readOnboardingState();
    setSelectedReaction(state.recommendation_feedback?.reaction ?? null);
    setRecommendationNote(state.recommendation_feedback?.note ?? "");

    if (state.feedback) {
      setFeedback(state.feedback);
      setPersonImage(state.image);
      setClosetBasis(
        buildResultClosetBasis(
          normalizeClosetItems(state.closet_items),
          state.feedback
        )
      );
      return;
    }

    if (state.fallback_message) {
      setFallbackMessage(state.fallback_message);
      return;
    }

    router.replace("/programs/style/onboarding/upload");
  }, [router]);

  useEffect(() => {
    let mounted = true;

    async function loadAccountState() {
      const user = await fetchAuthSession();

      if (!mounted) {
        return;
      }

      setAccountUser(user);
    }

    void loadAccountState();

    return () => {
      mounted = false;
    };
  }, []);

  function handleStartNewCheck() {
    const state = readOnboardingState();
    const preservedHistory =
      (state.feedback_history?.length ?? 0) > 0
        ? state.feedback_history
        : buildHistoryFromState(state);

    patchOnboardingState({
      image: undefined,
      text_description: undefined,
      feedback: undefined,
      daily_feedbacks: {},
      deep_dive_feedbacks: {},
      try_on_previews: {},
      feedback_history: preservedHistory,
      fallback_message: undefined
    });
    router.push("/programs/style/onboarding/upload");
  }

  async function handleSaveRecommendationFeedback() {
    if (!feedback || !selectedReaction) {
      return;
    }

    setRecommendationFeedbackStatus("saving");

    const nextFeedback = {
      reaction: selectedReaction,
      note: recommendationNote.trim() || undefined,
      outfit_title: feedback.recommended_outfit.title,
      created_at: new Date().toISOString()
    };
    syncHistoryFromState(
      patchOnboardingState({
        recommendation_feedback: nextFeedback
      })
    );

    try {
      if (accountUser) {
        const stateWithUser = syncHistoryFromState(
          patchOnboardingState({
            user_id: accountUser.uid,
            email: accountUser.email ?? undefined,
            recommendation_feedback: nextFeedback
          })
        );
        await saveRecommendationFeedbackToFirestore(stateWithUser, nextFeedback);
      }

      setRecommendationFeedbackStatus("saved");
    } catch {
      // Local feedback memory is already stored above. Remote sync failure should
      // not erase the user's personalization signal or block the next check.
      setRecommendationFeedbackStatus("saved");
    }
  }

  return (
    <main className="app-shell space-y-5">
      <div className="space-y-4 pt-3">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <button
              aria-label="사진 업로드 화면으로 돌아가기"
              className="app-back-button"
              onClick={() => router.push("/programs/style/onboarding/upload")}
              type="button"
            >
              ←
            </button>
            <p className="app-brand">RE:MAN</p>
          </div>
          <div className="app-header-actions">
            <CreditStatus variant="badge" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="poster-kicker">Style Check Result</p>
          <h1 className="screen-title">오늘 조합</h1>
        </div>
      </div>

      {feedback ? (
        <div className="space-y-5">
          <section className="result-hero-card" aria-label="스타일 체크 핵심 결과">
            <div className="result-hero-grid">
              <div className="result-photo-thumb">
                {personImage ? (
                  <Image
                    alt="분석 기준 전신 사진"
                    className="h-full w-full object-cover"
                    height={240}
                    priority
                    src={personImage}
                    unoptimized
                    width={200}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-2 text-center text-[11px] font-black leading-4 text-muted">
                    텍스트 기준
                  </div>
                )}
              </div>
              <div className="result-hero-copy">
                <div>
                  <p className="poster-kicker">오늘의 조합</p>
                  <h2>{feedback.recommended_outfit.title}</h2>
                </div>
              </div>
            </div>
            <div className="result-outfit-block">
              <div className="result-item-strip">
                {feedback.recommended_outfit.items.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="result-closet-basis">
            <div className="result-section-heading">
              <p className="poster-kicker">Closet Basis</p>
              <h2>내 옷장에서 쓴 것</h2>
            </div>
            {closetBasis.length > 0 ? (
              <>
                <div className="result-basis-summary">
                  <span>{closetBasisSummary.countLabel}</span>
                  <strong>{closetBasisSummary.reasonLabel}</strong>
                </div>
                <div className="result-basis-chip-grid">
                  {closetBasis.slice(0, 3).map((item) => (
                    <article
                      className={`result-basis-chip result-basis-${item.matchStatus}`}
                      key={`${item.category}-${item.itemName}-summary`}
                    >
                      <p>{item.label}</p>
                      <h3>{compactUiText(item.itemName, 18)}</h3>
                      <span>{item.statusLabel}</span>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="result-basis-empty">
                옷장 사진을 등록하면 다음 추천부터 근거가 보입니다.
              </div>
            )}
          </section>

          {todayPlan ? (
            <section className="result-next-action">
              <span>오늘 실행 3단계</span>
              <p>{compactUiText(todayPlan.summary, 50)}</p>
              <ol className="result-action-plan">
                {todayPlan.steps.map((step, index) => (
                  <li key={step.title}>
                    <b>{index + 1}</b>
                    <span>
                      <strong>{step.title}</strong>
                      <small>{step.detail}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="result-collapsible-panel">
            <div className="space-y-1">
              <p className="poster-kicker">Your Feedback</p>
              <h2 className="text-[24px] font-black leading-tight tracking-[-0.04em] text-ink">
                이 추천이 도움이 됐나요?
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {recommendationReactionOptions.map((option) => {
                const selected = selectedReaction === option.reaction;

                return (
                  <button
                    key={option.reaction}
                    aria-pressed={selected}
                    className={`ui-choice p-3 text-left ${selected ? "ui-choice-selected" : ""}`}
                    onClick={() => {
                      setSelectedReaction(option.reaction);
                      setRecommendationFeedbackStatus("idle");
                    }}
                    type="button"
                  >
                    <span className="block text-sm font-black">{option.label}</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 opacity-75">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="space-y-2">
              <span className="text-sm font-black text-ink">짧은 메모</span>
              <textarea
                className="min-h-20 w-full border border-black/20 bg-white p-4 text-sm font-medium text-ink outline-none focus:border-black"
                maxLength={120}
                onChange={(event) => {
                  setRecommendationNote(event.target.value);
                  setRecommendationFeedbackStatus("idle");
                }}
                placeholder="예: 셔츠 조합은 좋은데 신발은 애매했어요."
                value={recommendationNote}
              />
            </label>
            <button
              className="ui-button-secondary justify-between py-4 disabled:opacity-60"
              disabled={!selectedReaction || recommendationFeedbackStatus === "saving"}
              onClick={() => void handleSaveRecommendationFeedback()}
              type="button"
            >
              <span>
                {recommendationFeedbackStatus === "saving"
                  ? "반응 저장 중..."
                  : recommendationFeedbackStatus === "saved" && selectedReaction
                    ? `${getRecommendationFeedbackLabel(selectedReaction)} 저장됨`
                    : "추천 반응 저장"}
              </span>
              <span>→</span>
            </button>
            {recommendationFeedbackStatus === "error" ? (
              <p className="text-sm font-bold leading-6 text-red-700">
                계정 동기화 실패.
              </p>
            ) : null}
            {recommendationFeedbackStatus === "saved" && selectedReaction ? (
              <div className="result-feedback-memory">
                <p>다음 스타일 체크에 이 반응을 함께 반영합니다.</p>
                <div className="feedback-memory-summary">
                  <strong>다음 추천 기준</strong>
                  {buildRecommendationFeedbackMemory({
                    reaction: selectedReaction,
                    note: recommendationNote.trim() || undefined,
                    outfit_title: feedback.recommended_outfit.title,
                    created_at: new Date().toISOString()
                  }).map((row) => (
                    <span key={`${row.label}-${row.value}`}>
                      <b>{row.label}</b>
                      <em>{row.value}</em>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="result-action-dock" aria-label="스타일 체크 다음 단계">
            <button onClick={handleStartNewCheck} type="button">
              새 체크
            </button>
            <Link href="/history">기록에서 보기</Link>
          </section>

        </div>
      ) : (
        <div className="ui-panel">
          <p className="text-sm leading-6 text-ink">
            {fallbackMessage ?? "피드백을 찾지 못했습니다. 다시 시도해 주세요."}
          </p>
        </div>
      )}
    </main>
  );
}
