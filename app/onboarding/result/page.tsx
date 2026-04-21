"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SafePreviewImage } from "@/components/common/SafePreviewImage";
import { CreditStatus } from "@/components/credits/CreditStatus";
import type {
  AgentClosetItemCategory,
  OnboardingAgentResponse,
  SystemRecommendation
} from "@/lib/agents/contracts";
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
  type ClosetItem,
  type RecommendationFeedbackReaction,
  type TryOnPreviewCacheEntry
} from "@/lib/onboarding/storage";
import {
  buildClosetBasisMatches,
  buildClosetBasisSummary,
  type ClosetBasisItem
} from "@/lib/product/closet-basis";
import { buildTodayActionPlan } from "@/lib/product/today-action-plan";
import { buildOutfitBoardDataUrl } from "@/lib/try-on/outfit-board";

type RecommendationFeedbackStatus = "idle" | "saving" | "saved" | "error";
type TryOnStatus = "idle" | "generating" | "ready" | "error";
type RecommendationBlock = {
  key: "closet" | "system";
  title: string;
  kicker: string;
  badge?: string;
  body: JSX.Element;
};
type OutfitPreviewCard = {
  key: string;
  category: AgentClosetItemCategory;
  label: string;
  title: string;
  imageSrc: string;
  fallbackSrc: string;
  sourceLabel: string;
};

const categoryOrder: AgentClosetItemCategory[] = ["tops", "bottoms", "shoes"];
const categoryLabels: Record<AgentClosetItemCategory, string> = {
  tops: "상의",
  bottoms: "하의",
  shoes: "신발",
  outerwear: "겉옷"
};
const previewFallbacks: Record<AgentClosetItemCategory, string> = {
  tops: "/system-catalog/reference-top.svg",
  bottoms: "/system-catalog/reference-bottom.svg",
  shoes: "/system-catalog/reference-shoes.svg",
  outerwear: "/system-catalog/reference-outerwear.svg"
};
const TRY_ON_CACHE_KEY = "recommended";
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

function resolveClosetImage(item: ClosetItem | undefined, category: AgentClosetItemCategory) {
  return item?.photo_data_url || item?.image_url || previewFallbacks[category];
}

function buildResultClosetBasis(closetItems: ClosetItem[], feedback: OnboardingAgentResponse) {
  return buildClosetBasisMatches({
    closetItems,
    recommendedItems: feedback.recommended_outfit.items,
    sourceItemIds: feedback.recommended_outfit.source_item_ids,
    strategyItems: buildClosetStrategy(closetItems)?.items
  });
}

function findClosetItemMatch(
  closetItems: ClosetItem[],
  feedback: OnboardingAgentResponse,
  category: AgentClosetItemCategory,
  itemLabel: string
) {
  const sourceId = feedback.recommended_outfit.source_item_ids?.[category];
  const byId = sourceId
    ? closetItems.find((item) => item.category === category && item.id === sourceId)
    : undefined;

  if (byId) {
    return byId;
  }

  return closetItems.find(
    (item) =>
      item.category === category &&
      (item.name.includes(itemLabel) || itemLabel.includes(item.name))
  );
}

function buildOutfitPreviewCards(closetItems: ClosetItem[], feedback: OnboardingAgentResponse) {
  return categoryOrder.map((category, index) => {
    const title = feedback.recommended_outfit.items[index];
    const matched = findClosetItemMatch(closetItems, feedback, category, title);

    return {
      key: `outfit-${category}`,
      category,
      label: categoryLabels[category],
      title,
      imageSrc: resolveClosetImage(matched, category),
      fallbackSrc: previewFallbacks[category],
      sourceLabel: matched ? "내 옷장 사진" : "기준 레퍼런스"
    } satisfies OutfitPreviewCard;
  });
}

function buildSystemPreviewCards(feedback: OnboardingAgentResponse) {
  return feedback.system_recommendations.slice(0, 3).map((item) => ({
    ...item,
    imageSrc: item.image_url || previewFallbacks[item.category]
  }));
}

async function imageUrlToDataUrl(url: string) {
  if (url.startsWith("data:image/")) {
    return url;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("preview_fetch_failed");
  }

  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("preview_read_failed"));
    };
    reader.onerror = () => reject(new Error("preview_read_failed"));
    reader.readAsDataURL(blob);
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
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [closetBasis, setClosetBasis] = useState<ClosetBasisItem[]>([]);
  const [tryOnStatus, setTryOnStatus] = useState<TryOnStatus>("idle");
  const [tryOnPreview, setTryOnPreview] = useState<TryOnPreviewCacheEntry | null>(null);
  const [tryOnMessage, setTryOnMessage] = useState<string | null>(null);
  const [tryOnError, setTryOnError] = useState<string | null>(null);

  const todayPlan = feedback
    ? buildTodayActionPlan({
        todayAction: feedback.today_action,
        recommendedItems: feedback.recommended_outfit.items
      })
    : null;
  const closetBasisSummary = buildClosetBasisSummary(closetBasis);
  const outfitPreviewCards = useMemo(
    () => (feedback ? buildOutfitPreviewCards(closetItems, feedback) : []),
    [closetItems, feedback]
  );
  const systemPreviewCards = useMemo(
    () => (feedback ? buildSystemPreviewCards(feedback) : []),
    [feedback]
  );
  const effectivePersonImage =
    personImage ??
    (typeof window !== "undefined" ? readOnboardingState().image : undefined);
  const tryOnPersonImage =
    effectivePersonImage ??
    outfitPreviewCards.find((card) => card.imageSrc.startsWith("data:image/"))?.imageSrc;

  const recommendationBlocks: RecommendationBlock[] = feedback
    ? [
        {
          key: "closet" as const,
          title: "내 옷장 기준",
          kicker: "Closet Match",
          body: (
            <>
              <p className="result-recommendation-copy">{feedback.recommended_outfit.reason}</p>
              <div className="result-preview-grid">
                {outfitPreviewCards.map((card) => (
                  <article className="result-preview-card" key={card.key}>
                    <div className="result-preview-image">
                      <SafePreviewImage
                        alt={`추천 ${card.label}`}
                        className="h-full w-full object-cover"
                        fallbackSrc={card.fallbackSrc}
                        src={card.imageSrc}
                      />
                    </div>
                    <div className="result-preview-copy">
                      <span>{card.label}</span>
                      <strong>{card.title}</strong>
                      <small>{card.sourceLabel}</small>
                    </div>
                  </article>
                ))}
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
                        <small>{item.verificationLabel}</small>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="result-basis-empty">
                  옷장 사진을 등록하면 다음 추천부터 근거가 보입니다.
                </div>
              )}
            </>
          )
        },
        {
          key: "system" as const,
          title: "시스템 추천",
          kicker: "System Assist",
          badge: "시스템 추천 참고",
          body: (
            <>
              <p className="result-recommendation-copy">{feedback.recommendation_mix.summary}</p>
              {systemPreviewCards.length > 0 ? (
                <div className="result-system-grid">
                  {systemPreviewCards.map((item) => (
                    <article className="result-system-card" key={item.id}>
                      <div className="result-system-card-media">
                        <SafePreviewImage
                          alt={`시스템 추천 ${item.category}`}
                          className="h-full w-full object-cover"
                          fallbackSrc={previewFallbacks[item.category]}
                          src={item.imageSrc}
                        />
                      </div>
                      <div className="result-system-card-copy">
                        <p>{item.category}</p>
                        <h3>{item.title}</h3>
                        <span>
                          {[item.color, item.fit].filter(Boolean).join(" · ") || "reference"}
                        </span>
                        <small>{item.reason}</small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="result-basis-empty">
                  지금은 옷장 조합을 먼저 보고 다음 추천에서 시스템 후보를 보강합니다.
                </div>
              )}
            </>
          )
        }
      ].sort((left, right) => {
        const primary = feedback.recommendation_mix.primary_source;

        if (left.key === right.key) {
          return 0;
        }

        if (left.key === primary) {
          return -1;
        }

        if (right.key === primary) {
          return 1;
        }

        return 0;
      })
    : [];

  useEffect(() => {
    const state = readOnboardingState();
    setSelectedReaction(state.recommendation_feedback?.reaction ?? null);
    setRecommendationNote(state.recommendation_feedback?.note ?? "");

    if (state.feedback) {
      const normalizedClosetItems = normalizeClosetItems(state.closet_items);
      setFeedback(state.feedback);
      setPersonImage(state.image);
      setClosetItems(normalizedClosetItems);
      setClosetBasis(buildResultClosetBasis(normalizedClosetItems, state.feedback));
      setTryOnPreview(state.try_on_previews?.[TRY_ON_CACHE_KEY] ?? null);
      setTryOnMessage(state.try_on_previews?.[TRY_ON_CACHE_KEY]?.message ?? null);
      setTryOnStatus(state.try_on_previews?.[TRY_ON_CACHE_KEY] ? "ready" : "idle");
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
      setRecommendationFeedbackStatus("saved");
    }
  }

  async function handleGenerateTryOn() {
    if (!feedback || !tryOnPersonImage || outfitPreviewCards.length === 0) {
      setTryOnError("현재 사진과 추천 조합 이미지가 모두 있어야 실착을 만들 수 있습니다.");
      setTryOnStatus("error");
      return;
    }

    setTryOnStatus("generating");
    setTryOnError(null);
    setTryOnMessage(null);

    try {
      const productImage = await buildOutfitBoardDataUrl(
        outfitPreviewCards.map((card) => ({
          title: card.title,
          label: card.label,
          imageSrc: card.imageSrc,
          fallbackSrc: card.fallbackSrc
        }))
      );
      const response = await fetch("/api/try-on", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `try-on:${TRY_ON_CACHE_KEY}`
        },
        body: JSON.stringify({
          person_image: tryOnPersonImage,
          product_image: productImage,
          prompt: feedback.recommended_outfit.try_on_prompt
        })
      });
      const data = (await response.json().catch(() => null)) as
        | {
            preview_image?: string;
            message?: string;
            status?: "mocked" | "vertex";
          }
        | null;

      if (!response.ok || !data?.preview_image || !data.status) {
        throw new Error(
          typeof data?.message === "string" && data.message.trim()
            ? data.message
            : "실착 이미지를 만들지 못했습니다."
        );
      }

      const entry: TryOnPreviewCacheEntry = {
        cache_key: TRY_ON_CACHE_KEY,
        source: outfitPreviewCards.some((card) => card.sourceLabel === "내 옷장 사진")
          ? "upload"
          : "outfit-board",
        reference_id: feedback.recommended_outfit.title,
        prompt: feedback.recommended_outfit.try_on_prompt,
        provider: data.status,
        preview_image: data.preview_image,
        message: data.message ?? "실착 이미지가 준비됐습니다.",
        created_at: new Date().toISOString()
      };
      const current = readOnboardingState();

      patchOnboardingState({
        try_on_previews: {
          ...(current.try_on_previews ?? {}),
          [TRY_ON_CACHE_KEY]: entry
        }
      });
      setTryOnPreview(entry);
      setTryOnMessage(entry.message);
      setTryOnStatus("ready");
    } catch (error) {
      setTryOnStatus("error");
      setTryOnError(error instanceof Error ? error.message : "실착 이미지를 만들지 못했습니다.");
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
                {effectivePersonImage ? (
                  <Image
                    alt="분석 기준 전신 사진"
                    className="h-full w-full object-cover"
                    height={240}
                    priority
                    src={effectivePersonImage}
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

          <div className="result-recommendation-stack" aria-label="하이브리드 추천">
            {recommendationBlocks.map((block) => (
              <section
                aria-label={block.title}
                className="result-recommendation-card"
                data-testid="recommendation-block"
                key={block.key}
              >
                <div className="result-section-heading result-recommendation-heading">
                  <div>
                    <p className="poster-kicker">{block.kicker}</p>
                    <h2>{block.title}</h2>
                  </div>
                  {block.badge ? (
                    <span className="result-source-badge">{block.badge}</span>
                  ) : null}
                </div>
                {block.body}
              </section>
            ))}
          </div>

          <section className="result-try-on-panel" aria-label="실착 미리보기">
            <div className="result-section-heading">
              <div>
                <p className="poster-kicker">Try On</p>
                <h2>실착 보기</h2>
              </div>
              <span className="result-source-badge">
                {tryOnPreview?.provider === "vertex" ? "Vertex" : "Preview"}
              </span>
            </div>
            <p className="result-recommendation-copy">
              추천 상의, 하의, 신발을 한 장의 조합 보드로 묶어 현재 전신 사진에 입혀 봅니다.
            </p>
            <div className="result-try-on-layout">
              <div className="result-try-on-output">
                {tryOnPreview ? (
                  <Image
                    alt="실착 미리보기"
                    className="h-full w-full object-cover"
                    fill
                    sizes="(max-width: 768px) 100vw, 320px"
                    src={tryOnPreview.preview_image}
                    unoptimized
                  />
                ) : (
                  <div className="result-try-on-empty">
                    <strong>아직 실착 이미지가 없습니다.</strong>
                    <span>버튼을 눌러 현재 추천 기준으로 미리보기를 생성하세요.</span>
                  </div>
                )}
              </div>
              <div className="result-try-on-actions">
                <div className="result-try-on-source">
                  <span>실착 입력</span>
                  <strong>{feedback ? compactUiText(feedback.recommended_outfit.title, 22) : "추천 이미지 없음"}</strong>
                  <small>
                    {outfitPreviewCards.length > 0
                      ? "추천 상의 · 하의 · 신발 3개 조합 보드"
                      : "추천 조합 이미지가 필요합니다."}
                  </small>
                </div>
                <button
                  className="ui-button-secondary justify-between py-4 disabled:opacity-60"
                  disabled={!tryOnPersonImage || outfitPreviewCards.length === 0 || tryOnStatus === "generating"}
                  onClick={() => void handleGenerateTryOn()}
                  type="button"
                >
                  <span>
                    {tryOnStatus === "generating"
                      ? "실착 이미지 생성 중..."
                      : tryOnPreview
                        ? "실착 이미지 다시 만들기"
                        : "실착 이미지 만들기"}
                  </span>
                  <span>→</span>
                </button>
                {tryOnMessage ? <p className="result-try-on-message">{tryOnMessage}</p> : null}
                {tryOnError ? (
                  <p className="text-sm font-bold leading-6 text-red-700">{tryOnError}</p>
                ) : null}
              </div>
            </div>
          </section>

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
              <p className="text-sm font-bold leading-6 text-red-700">계정 동기화 실패.</p>
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
