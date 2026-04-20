"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditStatus } from "@/components/credits/CreditStatus";
import { fetchAuthSession } from "@/lib/auth/client";
import { readStyleProgramStateFromFirestore } from "@/lib/firebase/firestore";
import {
  buildHistoryFromState,
  getRecommendationFeedbackLabel,
  getStyleFeedbackTimeline,
  mergePersistedProgramState,
  patchOnboardingState,
  readOnboardingState,
  writeOnboardingState,
  type OnboardingState,
  type StyleFeedbackTimelineItem
} from "@/lib/onboarding/storage";
import type { ClosetBasisItem } from "@/lib/product/closet-basis";

type HistoryView = "day" | "week" | "month";

type HistoryCard = {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  action?: string;
  href?: string;
  count?: number;
  basis?: ClosetBasisItem[];
  reaction?: string;
  reactionNote?: string;
};

function compactUiText(value: string, maxLength = 54) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}...`;
}

function getSavedReactionText(state: OnboardingState) {
  if (!state.recommendation_feedback) {
    return "반응 미저장";
  }

  const label = getRecommendationFeedbackLabel(state.recommendation_feedback.reaction);
  const note = state.recommendation_feedback.note?.trim();

  return note ? `${label} · ${note}` : label;
}

function getLatestTitle(state: OnboardingState) {
  return state.feedback?.recommended_outfit.title ?? "저장된 체크 없음";
}

function getCardEyebrow(item: StyleFeedbackTimelineItem, index: number) {
  if (item.id === "style-check") {
    return "오늘";
  }

  if (item.id.startsWith("day-")) {
    return item.label.replace("Routine ", "");
  }

  if (item.id.startsWith("deep-dive-")) {
    return `추가 체크 ${index + 1}`;
  }

  return item.label;
}

function getCardHref(item: StyleFeedbackTimelineItem) {
  return item.id === "style-check" ? "/programs/style/onboarding/result" : undefined;
}

function buildDayCards(timeline: StyleFeedbackTimelineItem[]): HistoryCard[] {
  return timeline.map((item, index) => ({
    id: item.id,
    eyebrow: getCardEyebrow(item, index),
    title: item.title,
    summary: item.summary,
    action: item.action,
    href: getCardHref(item),
    basis: item.basis,
    reaction: item.reaction,
    reactionNote: item.reactionNote
  }));
}

function buildWeekCards(timeline: StyleFeedbackTimelineItem[]): HistoryCard[] {
  const styleItems = timeline.filter((item) => item.id === "style-check");
  const routineItems = timeline.filter((item) => item.id.startsWith("day-"));
  const deepDiveItems = timeline.filter((item) => item.id.startsWith("deep-dive-"));
  const cards: HistoryCard[] = [];

  if (styleItems.length > 0) {
    cards.push({
      id: "week-style",
      eyebrow: "이번 주",
      title: "스타일 체크",
      summary: styleItems.map((item) => item.title).join(" · "),
      action: styleItems[0]?.action,
      href: "/programs/style/onboarding/result",
      count: styleItems.length,
      basis: styleItems[0]?.basis,
      reaction: styleItems[0]?.reaction,
      reactionNote: styleItems[0]?.reactionNote
    });
  }

  if (routineItems.length > 0) {
    cards.push({
      id: "week-routine",
      eyebrow: "이번 주",
      title: "루틴 피드백",
      summary: routineItems.map((item) => item.title).join(" · "),
      action: routineItems.at(-1)?.action,
      count: routineItems.length
    });
  }

  if (deepDiveItems.length > 0) {
    cards.push({
      id: "week-deep-dive",
      eyebrow: "이번 주",
      title: "추가 체크",
      summary: deepDiveItems.map((item) => item.title).join(" · "),
      action: deepDiveItems.at(-1)?.action,
      count: deepDiveItems.length
    });
  }

  return cards;
}

function buildMonthCards(timeline: StyleFeedbackTimelineItem[]): HistoryCard[] {
  if (timeline.length === 0) {
    return [];
  }

  const latest = timeline[0];
  const deepDiveCount = timeline.filter((item) => item.id.startsWith("deep-dive-")).length;

  return [
    {
      id: "month-summary",
      eyebrow: "이번 달",
      title: `${timeline.length}개 기록`,
      summary: `대표 기록: ${latest.title}`,
      action: deepDiveCount > 0 ? `추가 체크 ${deepDiveCount}개 포함` : latest.action,
      href: latest.id === "style-check" ? "/programs/style/onboarding/result" : undefined,
      count: timeline.length,
      basis: latest.basis,
      reaction: latest.reaction,
      reactionNote: latest.reactionNote
    }
  ];
}

function buildCards(view: HistoryView, timeline: StyleFeedbackTimelineItem[]) {
  if (view === "week") {
    return buildWeekCards(timeline);
  }

  if (view === "month") {
    return buildMonthCards(timeline);
  }

  return buildDayCards(timeline);
}

export default function HistoryPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [latestTitle, setLatestTitle] = useState("저장된 체크 없음");
  const [reactionText, setReactionText] = useState("반응 미저장");
  const [timeline, setTimeline] = useState<StyleFeedbackTimelineItem[]>([]);
  const [view, setView] = useState<HistoryView>("day");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleStartSimilarCheck() {
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

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);

      const sessionUser = await fetchAuthSession();

      if (!sessionUser) {
        router.replace("/login?returnTo=/history");
        return;
      }

      if (!active) {
        return;
      }

      const localState = readOnboardingState();
      setLatestTitle(getLatestTitle(localState));
      setReactionText(getSavedReactionText(localState));
      setTimeline(getStyleFeedbackTimeline(localState));

      // Local history is already useful product state. Do not block the screen
      // on remote sync, because Firestore latency can make a valid history look broken.
      setIsLoading(false);

      try {
        const persistedProgramState = await readStyleProgramStateFromFirestore(sessionUser.uid);

        if (!active) {
          return;
        }

        const nextState = persistedProgramState
          ? mergePersistedProgramState(localState, persistedProgramState)
          : localState;

        writeOnboardingState(nextState);
        setLatestTitle(getLatestTitle(nextState));
        setReactionText(getSavedReactionText(nextState));
        setTimeline(getStyleFeedbackTimeline(nextState));
      } catch {
        // Keep the local history visible. Remote sync failures should not dominate this screen.
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  const cards = buildCards(view, timeline);

  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="space-y-5 pb-24 pt-6">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <Link className="app-back-button" href="/profile">
              ←
            </Link>
            <p className="app-brand">RE:MAN</p>
          </div>
          <div className="app-header-actions">
            <CreditStatus variant="badge" />
          </div>
        </div>

        <section className="screen-hero">
          <p className="poster-kicker">History</p>
          <h1 className="screen-title">기록</h1>
        </section>

        <section className="history-hero">
          <div>
            <p className="poster-kicker text-[var(--color-accent-ink)]/70">Latest</p>
            <h2 className="mt-2 text-[30px] font-black leading-[1.02] tracking-[-0.06em]">
              {isLoading ? "불러오는 중" : compactUiText(latestTitle, 32)}
            </h2>
          </div>
          <div className="history-pill">{compactUiText(reactionText, 24)}</div>
        </section>

        <section className="history-tabs" aria-label="기록 보기 방식">
          {[
            ["day", "일별"],
            ["week", "주별"],
            ["month", "월별"]
          ].map(([value, label]) => (
            <button
              aria-pressed={view === value}
              className={view === value ? "history-tab-active" : ""}
              key={value}
              onClick={() => {
                setView(value as HistoryView);
                setExpandedId(null);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </section>

        <section className="history-count">
          <p className="poster-kicker">Records</p>
          <p>{timeline.length}</p>
        </section>

        <section className="space-y-3">
          <p className="poster-kicker">Saved</p>
          {cards.length > 0 ? (
            <div className="history-card-list">
              {cards.map((card) => {
                const isExpanded = expandedId === card.id;

                return (
                  <article className="history-card" key={card.id}>
                    <button
                      aria-expanded={isExpanded}
                      className="history-card-trigger"
                      onClick={() => setExpandedId(isExpanded ? null : card.id)}
                      type="button"
                    >
                      <span className="history-card-index">{card.count ?? "•"}</span>
                      <span>
                        <span className="history-label">{card.eyebrow}</span>
                        <strong>{compactUiText(card.title, 30)}</strong>
                        <small>{compactUiText(card.summary, 42)}</small>
                      </span>
                      <span className="history-card-toggle">{isExpanded ? "닫기" : "열기"}</span>
                    </button>
                    {isExpanded ? (
                      <div className="history-card-detail">
                        <div className="history-detail-grid">
                          <section aria-label="추천 조합" className="history-detail-panel">
                            <span>추천 조합</span>
                            <strong>{compactUiText(card.title, 34)}</strong>
                          </section>
                          <section aria-label="다음 행동" className="history-detail-panel">
                            <span>오늘 실행</span>
                            <strong>{compactUiText(card.action ?? "다시 체크", 34)}</strong>
                          </section>
                        </div>
                        {card.basis?.length ? (
                          <div className="history-basis">
                            <div className="history-section-head">
                              <p className="poster-kicker">추천에 쓴 옷</p>
                              <small>{card.basis.length}개</small>
                            </div>
                            <div className="history-basis-grid">
                              {card.basis.slice(0, 3).map((basis) => (
                                <div className="history-basis-chip" key={`${card.id}-${basis.category}`}>
                                  <span>
                                    <b>{basis.label}</b>
                                    <em>{basis.statusLabel}</em>
                                  </span>
                                  <strong>{basis.itemName}</strong>
                                  <small>{basis.verificationLabel}</small>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <section aria-label="저장한 반응" className="history-detail-panel">
                          <span>내 반응</span>
                          <strong>
                            {card.reaction
                              ? compactUiText(
                                  card.reactionNote
                                    ? `${card.reaction} · ${card.reactionNote}`
                                    : card.reaction,
                                  54
                                )
                              : "없음"}
                          </strong>
                        </section>
                        <div className="history-basis">
                          <div className="history-section-head">
                            <p className="poster-kicker">다시 체크</p>
                            <small>유지 항목</small>
                          </div>
                          <div className="history-basis-grid">
                            <div className="history-basis-chip">
                              <span>
                                <b>옷장</b>
                                <em>유지</em>
                              </span>
                              <strong>옷장 유지</strong>
                              <small>등록한 옷은 그대로 씁니다.</small>
                            </div>
                            <div className="history-basis-chip">
                              <span>
                                <b>반응</b>
                                <em>유지</em>
                              </span>
                              <strong>반응 유지</strong>
                              <small>좋아한 방향을 다음 추천에 반영합니다.</small>
                            </div>
                            <div className="history-basis-chip">
                              <span>
                                <b>사진</b>
                                <em>새로</em>
                              </span>
                              <strong>사진만 새로</strong>
                              <small>현재 사진과 결과만 비웁니다.</small>
                            </div>
                          </div>
                        </div>
                        <button
                          className="history-repeat-button"
                          onClick={handleStartSimilarCheck}
                          type="button"
                        >
                          비슷하게 다시 체크
                        </button>
                        {card.href ? (
                          <Link className="history-result-link" href={card.href}>결과 보기</Link>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">기록 없음</div>
          )}
        </section>
      </div>

      <div className="pb-10" />
    </main>
  );
}
