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
  RecommendationRole,
  SelectableRecommendation,
  SystemRecommendation
} from "@/lib/agents/contracts";
import { fetchAuthSession } from "@/lib/auth/client";
import type { AuthUser } from "@/lib/auth/types";
import {
  buildClosetPreviewRequestKey,
  fetchClosetPreviewUrls,
  type ClosetPreviewMap
} from "@/lib/closet/preview-client";
import { patchCreditStatusCache } from "@/lib/credits/client";
import {
  readStyleProgramStateFromFirestore,
  saveRecommendationFeedbackToFirestore
} from "@/lib/firebase/firestore";
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
  type OnboardingState,
  type RecommendationFeedbackReaction,
  type TryOnPreviewCacheEntry,
  writeOnboardingState
} from "@/lib/onboarding/storage";
import { resolveResultPageState } from "@/lib/onboarding/result-state";
import {
  buildClosetBasisMatches,
  buildClosetBasisSummary,
  type ClosetBasisItem
} from "@/lib/product/closet-basis";
import { SYSTEM_STYLE_LIBRARY } from "@/lib/product/system-style-library";
import { buildTodayActionPlan } from "@/lib/product/today-action-plan";

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
type TryOnInputSource = "system" | "closet";
type TryOnBoardCard = {
  id: string;
  key: string;
  category: AgentClosetItemCategory;
  role?: RecommendationRole;
  label: string;
  title: string;
  imageSrc: string;
  fallbackSrc: string;
  sourceLabel: string;
  layerOrder: number;
};

type StoredTryOnRequestedItem = NonNullable<TryOnPreviewCacheEntry["requested_items"]>[number];
type StoredTryOnStagePreview = NonNullable<TryOnPreviewCacheEntry["stage_previews"]>[number];

const categoryOrder: AgentClosetItemCategory[] = ["tops", "bottoms", "shoes"];
const categoryLabels: Record<AgentClosetItemCategory, string> = {
  tops: "상의",
  bottoms: "하의",
  shoes: "신발",
  outerwear: "겉옷",
  hats: "모자",
  bags: "가방"
};
const previewFallbacks: Record<AgentClosetItemCategory, string> = {
  tops: "/system-catalog/reference-top.svg",
  bottoms: "/system-catalog/reference-bottom.svg",
  shoes: "/system-catalog/reference-shoes.svg",
  outerwear: "/system-catalog/reference-outerwear.svg",
  hats: "/system-catalog/reference-top.svg",
  bags: "/system-catalog/reference-bottom.svg"
};
const legacyReferenceArtworkPattern =
  /\/system-catalog\/reference-(top|bottom|shoes|outerwear)\.svg$/;
const TRY_ON_CACHE_KEY = "recommended";
const TRY_ON_CREDIT_COST = 1;
const TRY_ON_CREDIT_ITEM_UNIT = 3;
const TRY_ON_DIRECT_PASS_ITEM_LIMIT = 3;
const roleOrder: Record<RecommendationRole, number> = {
  base_top: 10,
  mid_top: 20,
  outerwear: 30,
  bottom: 40,
  shoes: 50,
  addon: 60
};
const categoryTryOnOrder: Record<AgentClosetItemCategory, number> = {
  tops: 10,
  outerwear: 30,
  bottoms: 40,
  shoes: 50,
  hats: 60,
  bags: 70
};
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

function mergePreviewUrlsIntoItems(items: ClosetItem[], previewUrls: ClosetPreviewMap) {
  let changed = false;
  const nextItems = items.map((item) => {
    const previewUrl = previewUrls[item.id];

    if (!previewUrl || item.photo_data_url || item.image_url === previewUrl) {
      return item;
    }

    changed = true;
    return {
      ...item,
      image_url: previewUrl
    };
  });

  return changed ? nextItems : items;
}

function getCanonicalSystemReference(category: AgentClosetItemCategory) {
  return SYSTEM_STYLE_LIBRARY.find((item) => item.category === category);
}

function isLegacyReferenceArtwork(imageUrl: string | undefined) {
  return !imageUrl || legacyReferenceArtworkPattern.test(imageUrl);
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
  const sourceRecommendations =
    feedback.selectable_recommendations?.length && feedback.selectable_recommendations.length > 0
      ? feedback.selectable_recommendations
      : feedback.system_recommendations;

  return sourceRecommendations.map((item) => {
    const canonical = getCanonicalSystemReference(item.category);
    const displayItem =
      canonical && isLegacyReferenceArtwork(item.image_url)
        ? {
            ...canonical,
            id: item.id,
            reason: item.reason || canonical.reason
          }
        : item;

    return {
      ...displayItem,
      imageSrc: displayItem.image_url || previewFallbacks[displayItem.category]
    };
  }) as Array<
    (SystemRecommendation | SelectableRecommendation) & {
      imageSrc: string;
    }
  >;
}

function buildSystemTryOnCards(
  systemPreviewCards: Array<
    (SystemRecommendation | SelectableRecommendation) & {
      imageSrc: string;
    }
  >,
  outfitPreviewCards: OutfitPreviewCard[]
) {
  return systemPreviewCards.map((item) => {
    const closetFallback = outfitPreviewCards.find((card) => card.category === item.category);

    return {
      id: item.id,
      key: `try-on-${item.id}`,
      category: item.category,
      role: item.role,
      label: categoryLabels[item.category],
      title: item.title,
      imageSrc: item.imageSrc ?? closetFallback?.imageSrc ?? previewFallbacks[item.category],
      fallbackSrc: closetFallback?.fallbackSrc ?? previewFallbacks[item.category],
      sourceLabel: "시스템 추천",
      layerOrder:
        item.layer_order_default ??
        (item.role ? roleOrder[item.role] : categoryTryOnOrder[item.category])
    } satisfies TryOnBoardCard;
  });
}

function buildDefaultTryOnSelection(
  feedback: OnboardingAgentResponse | null,
  cards: TryOnBoardCard[]
) {
  if (!feedback || cards.length === 0) {
    return [] as string[];
  }

  const preferredIds =
    feedback.primary_outfit?.item_ids.filter((itemId) => cards.some((card) => card.id === itemId)) ??
    [];

  if (preferredIds.length > 0) {
    return preferredIds;
  }

  return cards
    .slice()
    .sort((left, right) => left.layerOrder - right.layerOrder)
    .slice(0, 3)
    .map((card) => card.id);
}

function sortSelectedTryOnCards(
  cards: TryOnBoardCard[],
  selectedIds: string[],
  manualOrderIds: string[],
  manualOrderEnabled: boolean
) {
  const selected = cards.filter((card) => selectedIds.includes(card.id));

  if (manualOrderEnabled && manualOrderIds.length > 0) {
    const rank = new Map(manualOrderIds.map((id, index) => [id, index]));

    return selected.sort((left, right) => {
      const leftRank = rank.get(left.id);
      const rightRank = rank.get(right.id);

      if (leftRank !== undefined && rightRank !== undefined && leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      if (left.layerOrder !== right.layerOrder) {
        return left.layerOrder - right.layerOrder;
      }

      return left.title.localeCompare(right.title, "ko");
    });
  }

  return selected.sort((left, right) => {
    if (left.layerOrder !== right.layerOrder) {
      return left.layerOrder - right.layerOrder;
    }

    return left.title.localeCompare(right.title, "ko");
  });
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

function buildTryOnPrompt(
  feedback: OnboardingAgentResponse,
  cards: TryOnBoardCard[],
  source: TryOnInputSource
) {
  const orderedOutfitLine = cards
    .map((card, index) => `${index + 1}. ${card.label}: ${card.title}`)
    .join(" / ");
  const sourceLine =
    source === "system" ? "시스템 추천 조합 전체를 함께 반영" : "내 옷장 조합 전체를 함께 반영";

  return `${feedback.recommended_outfit.try_on_prompt} ${sourceLine}. 선택된 모든 아이템을 같은 최종 이미지 한 장에 함께 반영하고 어떤 아이템도 누락하지 말 것. 위에서 아래 순서를 유지할 것. 신발과 가방, 모자까지 선택된 경우 끝까지 모두 반영할 것: ${orderedOutfitLine}`;
}

function estimateTryOnCredits(cardCount: number) {
  return Math.max(1, Math.ceil(cardCount / TRY_ON_CREDIT_ITEM_UNIT)) * TRY_ON_CREDIT_COST;
}

function estimateTryOnPasses(cardCount: number) {
  return Math.max(1, Math.ceil(cardCount / TRY_ON_DIRECT_PASS_ITEM_LIMIT));
}

function buildStoredRequestedItems(cards: TryOnBoardCard[]): StoredTryOnRequestedItem[] {
  return cards.map((card) => ({
    id: card.id,
    category: card.category,
    label: card.label,
    title: card.title,
    image_src: card.imageSrc,
    fallback_src: card.fallbackSrc,
    source_label: card.sourceLabel
  }));
}

function getPreviewRequestedItems(preview: TryOnPreviewCacheEntry | null, cards: TryOnBoardCard[]) {
  if (preview?.requested_items?.length) {
    return preview.requested_items.map((item) => ({
      ...item,
      key: `preview-requested-${item.id}`
    }));
  }

  return cards.map((card) => ({
    id: card.id,
    category: card.category,
    label: card.label,
    title: card.title,
    image_src: card.imageSrc,
    fallback_src: card.fallbackSrc,
    source_label: card.sourceLabel,
    key: `live-requested-${card.id}`
  }));
}

function getPreviewStageItems(preview: TryOnPreviewCacheEntry | null): Array<
  StoredTryOnStagePreview & { key: string }
> {
  if (!preview?.stage_previews?.length) {
    return [];
  }

  return preview.stage_previews.map((stage) => ({
    ...stage,
    key: `stage-${stage.step}`
  }));
}

export default function ResultPage() {
  const router = useRouter();
  const [isHydrating, setIsHydrating] = useState(true);
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
  const [isTryOnComposerOpen, setIsTryOnComposerOpen] = useState(false);
  const [isTryOnViewerOpen, setIsTryOnViewerOpen] = useState(false);
  const [selectedTryOnSource, setSelectedTryOnSource] =
    useState<TryOnInputSource>("system");
  const [selectedSystemTryOnIds, setSelectedSystemTryOnIds] = useState<string[]>([]);
  const [manualTryOnOrderEnabled, setManualTryOnOrderEnabled] = useState(false);
  const [manualSystemTryOnOrderIds, setManualSystemTryOnOrderIds] = useState<string[]>([]);

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
  const systemTryOnCards = useMemo(
    () => buildSystemTryOnCards(systemPreviewCards, outfitPreviewCards),
    [outfitPreviewCards, systemPreviewCards]
  );
  const closetPreviewRequestKey = useMemo(
    () => buildClosetPreviewRequestKey(closetItems),
    [closetItems]
  );
  const defaultTryOnSource: TryOnInputSource =
    systemPreviewCards.length > 0 ? "system" : "closet";
  const effectivePersonImage =
    personImage ??
    (typeof window !== "undefined" ? readOnboardingState().image : undefined);
  const tryOnPersonImage =
    effectivePersonImage ??
    outfitPreviewCards.find((card) => card.imageSrc.startsWith("data:image/"))?.imageSrc;
  const selectedTryOnCards: TryOnBoardCard[] =
    selectedTryOnSource === "system"
      ? sortSelectedTryOnCards(
          systemTryOnCards,
          selectedSystemTryOnIds,
          manualSystemTryOnOrderIds,
          manualTryOnOrderEnabled
        )
      : outfitPreviewCards.map((card, index) => ({
          id: card.key,
          key: card.key,
          category: card.category,
          role: categoryOrder[index] === "tops" ? "base_top" : categoryOrder[index] === "bottoms" ? "bottom" : "shoes",
          label: card.label,
          title: card.title,
          imageSrc: card.imageSrc,
          fallbackSrc: card.fallbackSrc,
          sourceLabel: card.sourceLabel,
          layerOrder: categoryOrder[index] === "tops" ? 10 : categoryOrder[index] === "bottoms" ? 40 : 50
        } satisfies TryOnBoardCard));
  const tryOnCreditEstimate = estimateTryOnCredits(selectedTryOnCards.length);
  const tryOnPassEstimate = estimateTryOnPasses(selectedTryOnCards.length);
  const previewRequestedItems = getPreviewRequestedItems(tryOnPreview, selectedTryOnCards);
  const previewStageItems = getPreviewStageItems(tryOnPreview);

  function applyResolvedState(state: OnboardingState) {
    const normalizedClosetItems = normalizeClosetItems(state.closet_items);

    setSelectedReaction(state.recommendation_feedback?.reaction ?? null);
    setRecommendationNote(state.recommendation_feedback?.note ?? "");
    setPersonImage(state.image);

    if (state.feedback) {
      setFallbackMessage(null);
      setFeedback(state.feedback);
      setClosetItems(normalizedClosetItems);
      setClosetBasis(buildResultClosetBasis(normalizedClosetItems, state.feedback));
      setTryOnPreview(state.try_on_previews?.[TRY_ON_CACHE_KEY] ?? null);
      setTryOnMessage(state.try_on_previews?.[TRY_ON_CACHE_KEY]?.message ?? null);
      setTryOnStatus(state.try_on_previews?.[TRY_ON_CACHE_KEY] ? "ready" : "idle");
      return;
    }

    setFeedback(null);
    setClosetItems(normalizedClosetItems);
    setClosetBasis([]);
    setTryOnPreview(null);
    setTryOnMessage(null);
    setTryOnStatus("idle");
    setFallbackMessage(state.fallback_message ?? null);
  }

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
                <div className="space-y-4">
                  <div className="result-basis-summary">
                    <span>선택 실착 후보</span>
                    <strong>원하는 아이템만 골라 조합합니다</strong>
                  </div>
                  <div
                    className="result-item-strip result-item-strip-surface"
                    aria-label="선택된 시스템 추천 아이템"
                  >
                    {selectedSystemTryOnIds.length > 0 ? (
                      sortSelectedTryOnCards(
                        systemTryOnCards,
                        selectedSystemTryOnIds,
                        manualSystemTryOnOrderIds,
                        manualTryOnOrderEnabled
                      ).map((card) => <span key={`selected-${card.id}`}>{card.title}</span>)
                    ) : (
                      <span>선택된 아이템 없음</span>
                    )}
                  </div>
                  <div className="result-system-grid">
                    {systemPreviewCards.map((item) => {
                      const isSelected = selectedSystemTryOnIds.includes(item.id);

                      return (
                        <button
                          aria-pressed={isSelected}
                          className={`result-system-card text-left ${isSelected ? "ring-2 ring-black" : ""}`}
                          key={item.id}
                          onClick={() => handleToggleSystemTryOnCard(item.id)}
                          type="button"
                        >
                          <div className="result-system-card-media">
                            <SafePreviewImage
                              alt={`시스템 추천 ${item.category}`}
                              className="h-full w-full object-cover"
                              fallbackSrc={previewFallbacks[item.category]}
                              src={item.imageSrc}
                            />
                          </div>
                          <div className="result-system-card-copy">
                            <p>{item.role ? categoryLabels[item.category] : item.category}</p>
                            <h3>{item.title}</h3>
                            <span>
                              {[item.color, item.fit].filter(Boolean).join(" · ") || "reference"}
                            </span>
                            <small>{item.reason}</small>
                          </div>
                        </button>
                      );
                    })}
                  </div>
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
    let active = true;
    const localState = readOnboardingState();

    if (localState.feedback || localState.fallback_message) {
      applyResolvedState(localState);
      setIsHydrating(false);
    }

    async function loadResultState() {
      try {
        const user = await fetchAuthSession();

        if (!active) {
          return;
        }

        setAccountUser(user);

        if (!user) {
          if (!localState.feedback && !localState.fallback_message) {
            router.replace("/programs/style/onboarding/upload");
          }
          return;
        }

        const persistedProgramState = await readStyleProgramStateFromFirestore(user.uid);

        if (!active) {
          return;
        }

        const nextState = resolveResultPageState(localState, persistedProgramState);

        writeOnboardingState(nextState);
        applyResolvedState(nextState);

        if (!nextState.feedback && !nextState.fallback_message) {
          router.replace("/programs/style/onboarding/upload");
        }
      } catch {
        if (!localState.feedback && !localState.fallback_message) {
          router.replace("/programs/style/onboarding/upload");
        }
      } finally {
        if (active) {
          setIsHydrating(false);
        }
      }
    }

    void loadResultState();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (systemTryOnCards.length === 0) {
      setSelectedSystemTryOnIds([]);
      setManualSystemTryOnOrderIds([]);
      setManualTryOnOrderEnabled(false);
      return;
    }

    const defaultSelection = buildDefaultTryOnSelection(feedback, systemTryOnCards);

    setSelectedSystemTryOnIds((current) =>
      current.length > 0 &&
      current.every((id) => systemTryOnCards.some((card) => card.id === id))
        ? current
        : defaultSelection
    );
    setManualSystemTryOnOrderIds((current) =>
      current.length > 0 &&
      current.every((id) => systemTryOnCards.some((card) => card.id === id))
        ? current
        : defaultSelection
    );
  }, [feedback, systemTryOnCards]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    setSelectedTryOnSource(defaultTryOnSource);
  }, [defaultTryOnSource, feedback]);

  useEffect(() => {
    let active = true;

    async function syncClosetPreviews() {
      if (!feedback || !accountUser || !closetPreviewRequestKey) {
        return;
      }

      try {
        const previewUrls = await fetchClosetPreviewUrls(closetItems);

        if (!active || Object.keys(previewUrls).length === 0) {
          return;
        }

        setClosetItems((currentItems) => mergePreviewUrlsIntoItems(currentItems, previewUrls));
      } catch {
        // Keep the existing preview state. Result page should still render
        // even when signed preview refresh fails.
      }
    }

    void syncClosetPreviews();

    return () => {
      active = false;
    };
  }, [accountUser, closetItems, closetPreviewRequestKey, feedback]);

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

  function handleToggleSystemTryOnCard(cardId: string) {
    setManualTryOnOrderEnabled(false);
    setSelectedSystemTryOnIds((current) => {
      if (current.includes(cardId)) {
        const next = current.filter((id) => id !== cardId);
        setManualSystemTryOnOrderIds(next);
        return next;
      }

      const next = [...current, cardId];
      setManualSystemTryOnOrderIds(next);
      return next;
    });
  }

  function handleRestoreAutoOrder() {
    setManualTryOnOrderEnabled(false);
    setManualSystemTryOnOrderIds(selectedSystemTryOnIds);
  }

  function handleMoveSelectedCard(cardId: string, direction: -1 | 1) {
    setManualTryOnOrderEnabled(true);
    setManualSystemTryOnOrderIds((current) => {
      const working =
        current.length > 0 ? current.filter((id) => selectedSystemTryOnIds.includes(id)) : [...selectedSystemTryOnIds];
      const index = working.indexOf(cardId);

      if (index === -1) {
        return working;
      }

      const targetIndex = index + direction;

      if (targetIndex < 0 || targetIndex >= working.length) {
        return working;
      }

      const currentCard = systemTryOnCards.find((card) => card.id === cardId);
      const targetCard = systemTryOnCards.find((card) => card.id === working[targetIndex]);

      if (!currentCard || !targetCard || currentCard.layerOrder !== targetCard.layerOrder) {
        return working;
      }

      const next = [...working];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  async function handleGenerateTryOn() {
    if (!accountUser) {
      setTryOnError("로그인 세션을 먼저 확인한 뒤 다시 시도해 주세요.");
      setTryOnStatus("error");
      return;
    }

    if (!feedback || !tryOnPersonImage || selectedTryOnCards.length === 0) {
      setTryOnError("현재 사진과 실착 대상 아이템 이미지가 모두 있어야 실착을 만들 수 있습니다.");
      setTryOnStatus("error");
      return;
    }

    setTryOnStatus("generating");
    setTryOnError(null);
    setTryOnMessage(null);

    try {
      const productImages = await Promise.all(
        selectedTryOnCards.map((card) =>
          imageUrlToDataUrl(card.imageSrc).catch(() => imageUrlToDataUrl(card.fallbackSrc))
        )
      );
      const response = await fetch("/api/try-on", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `try-on:${TRY_ON_CACHE_KEY}`
        },
        body: JSON.stringify({
          person_image: tryOnPersonImage,
          product_images: productImages,
          selected_items: selectedTryOnCards.map((card) => ({
            id: card.id,
            category: card.category,
            role: card.role,
            title: card.title,
            image_url: card.imageSrc
          })),
          manual_order_enabled: selectedTryOnSource === "system" ? manualTryOnOrderEnabled : false,
          ordered_item_ids:
            selectedTryOnSource === "system" ? selectedTryOnCards.map((card) => card.id) : [],
          prompt: buildTryOnPrompt(feedback, selectedTryOnCards, selectedTryOnSource)
        })
      });
      const data = (await response.json().catch(() => null)) as
        | {
            preview_image?: string;
            message?: string;
            status?: "mocked" | "vertex";
            credits_remaining?: number;
            credits_charged?: number;
            subscription_active?: boolean;
            try_on_pass_count?: number;
            visibility_guidance?: string | null;
            review_required?: boolean;
            review_reason?: string | null;
            stage_previews?: Array<{
              step: number;
              preview_image: string;
              label?: string;
              retry_attempted?: boolean;
              auto_corrected?: boolean;
              correction_failed?: boolean;
            }>;
          }
        | null;

      if (!response.ok || !data?.preview_image || !data.status) {
        throw new Error(
          typeof data?.message === "string" && data.message.trim()
            ? data.message
            : "실착 이미지를 만들지 못했습니다."
        );
      }

      if (typeof data.credits_remaining === "number") {
        patchCreditStatusCache({
          balance: data.credits_remaining,
          subscription_active: data.subscription_active
        });
      }

      const entry: TryOnPreviewCacheEntry = {
        cache_key: TRY_ON_CACHE_KEY,
        source: outfitPreviewCards.some((card) => card.sourceLabel === "내 옷장 사진")
          ? "upload"
          : "outfit-board",
        reference_id: selectedTryOnCards.map((card) => card.id).join(","),
        prompt: feedback.recommended_outfit.try_on_prompt,
        provider: data.status,
        preview_image: data.preview_image,
        message: data.message ?? "실착 이미지가 준비됐습니다.",
        visibility_guidance: data.visibility_guidance ?? undefined,
        review_required: data.review_required ?? undefined,
        review_reason: data.review_reason ?? undefined,
        pass_count: data.try_on_pass_count,
        requested_items: buildStoredRequestedItems(selectedTryOnCards),
        stage_previews: data.stage_previews ?? [],
        credits_charged: data.credits_charged,
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
      setIsTryOnComposerOpen(false);
      setIsTryOnViewerOpen(true);
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

      {isHydrating ? (
        <section className="result-recommendation-card" aria-label="결과 불러오는 중">
          <div className="result-section-heading">
            <div>
              <p className="poster-kicker">Result</p>
              <h2>결과를 불러오는 중</h2>
            </div>
          </div>
          <p className="result-recommendation-copy">
            저장된 스타일 체크 결과를 확인하고 있습니다.
          </p>
        </section>
      ) : feedback ? (
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
              <p>{todayPlan.summary}</p>
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
              실착은 선택된 추천 아이템을 순차로 반영해 한 장의 결과로 만듭니다. 기본은 시스템 추천 조합입니다.
            </p>
            <div className="result-try-on-layout">
              <div className="result-try-on-output">
                {tryOnPreview ? (
                  <button
                    className="result-try-on-preview-button"
                    onClick={() => setIsTryOnViewerOpen(true)}
                    type="button"
                  >
                    <Image
                      alt="실착 미리보기"
                      className="h-full w-full object-contain"
                      fill
                      sizes="(max-width: 768px) 100vw, 320px"
                      src={tryOnPreview.preview_image}
                      unoptimized
                    />
                  </button>
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
                  <strong>
                    {selectedTryOnSource === "system"
                      ? "선택한 시스템 추천 조합"
                      : feedback
                        ? compactUiText(feedback.recommended_outfit.title, 22)
                        : "추천 이미지 없음"}
                  </strong>
                  <small>
                    {selectedTryOnCards.length > 0
                      ? selectedTryOnCards
                          .map((card) => `${card.label} · ${compactUiText(card.title, 14)}`)
                          .join(" / ")
                      : "실착 대상 이미지가 필요합니다."}
                  </small>
                </div>
                <button
                  className="ui-button-secondary justify-between py-4 disabled:opacity-60"
                  disabled={
                    !accountUser ||
                    !tryOnPersonImage ||
                    selectedTryOnCards.length === 0 ||
                    tryOnStatus === "generating"
                  }
                  onClick={() => {
                    setSelectedTryOnSource(defaultTryOnSource);
                    setTryOnError(null);
                    setIsTryOnComposerOpen(true);
                  }}
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
                <p className="result-try-on-credit-note">
                  선택 {selectedTryOnCards.length}개 · 예상 {tryOnPassEstimate} pass · 크레딧 {tryOnCreditEstimate}
                </p>
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
            <button
              disabled={tryOnStatus === "generating"}
              onClick={handleStartNewCheck}
              type="button"
            >
              새 체크
            </button>
            <Link href="/history">기록에서 보기</Link>
          </section>

          {isTryOnComposerOpen ? (
            <div className="result-modal-backdrop" role="presentation">
              <div
                aria-label={tryOnStatus === "generating" ? "실착 생성 중" : "실착 생성 설정"}
                aria-modal="true"
                className="result-modal"
                role="dialog"
              >
                {tryOnStatus === "generating" ? (
                  <div className="result-modal-blocking">
                    <span aria-hidden="true" className="result-spinner" />
                    <strong>실착 생성 중</strong>
                    <p>생성이 끝날 때까지 다른 작업은 잠시 멈춥니다.</p>
                    <small>
                    {selectedTryOnSource === "system" ? "시스템 추천 조합" : "내 옷장 조합"} ·
                      선택 조합 반영 · 최대 3개당 1 크레딧 차감
                    </small>
                  </div>
                ) : (
                  <>
                    <div className="result-modal-header">
                      <div>
                        <p className="poster-kicker">Try On Setup</p>
                        <h2>실착 생성 설정</h2>
                      </div>
                      <button
                        className="result-modal-close"
                        onClick={() => setIsTryOnComposerOpen(false)}
                        type="button"
                      >
                        닫기
                      </button>
                    </div>
                    <p className="result-recommendation-copy">
                      선택한 추천 아이템만 순차 합성해 최종 실착 이미지를 만듭니다. 기본은 시스템 추천 조합이고, 원하면 내 옷장 기준으로 바꿀 수 있습니다.
                    </p>
                    <div className="result-try-on-source-picker">
                      <button
                        aria-pressed={selectedTryOnSource === "system"}
                        className={`ui-choice p-4 ${selectedTryOnSource === "system" ? "ui-choice-selected" : ""}`}
                        onClick={() => setSelectedTryOnSource("system")}
                        type="button"
                      >
                        <strong>시스템 추천 조합</strong>
                        <small>추천 스타일 전체를 기준으로 실착을 만듭니다.</small>
                      </button>
                      <button
                        aria-pressed={selectedTryOnSource === "closet"}
                        className={`ui-choice p-4 ${selectedTryOnSource === "closet" ? "ui-choice-selected" : ""}`}
                        onClick={() => setSelectedTryOnSource("closet")}
                        type="button"
                      >
                        <strong>내 옷장 조합</strong>
                        <small>지금 가진 옷 조합으로 실착을 만듭니다.</small>
                      </button>
                    </div>
                    <div className="result-try-on-modal-summary">
                      <strong>
                        {selectedTryOnSource === "system" ? "시스템 추천 기준" : "내 옷장 기준"}
                      </strong>
                      <span>
                        {selectedTryOnSource === "system"
                          ? "추천 조합 전체를 순차로 반영합니다."
                          : "내 옷장 조합 전체를 순차로 반영합니다."}
                      </span>
                      <small>
                        선택 {selectedTryOnCards.length}개 · 예상 {tryOnPassEstimate} pass · 크레딧 {tryOnCreditEstimate}
                      </small>
                    </div>
                    {selectedTryOnSource === "system" ? (
                      <div className="result-try-on-modal-summary">
                        <strong>레이어 순서</strong>
                        <span>자동 정렬이 기본이며, 같은 레이어 그룹 안에서만 순서를 바꿀 수 있습니다.</span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="ui-button-secondary px-3 py-2"
                            onClick={handleRestoreAutoOrder}
                            type="button"
                          >
                            자동 정렬로 복원
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="result-try-on-modal-grid">
                      {selectedTryOnCards.map((card, index) => (
                        <article className="result-try-on-modal-card" key={card.key}>
                          <div className="result-try-on-modal-image">
                            <SafePreviewImage
                              alt={`${selectedTryOnSource === "system" ? "시스템 추천" : "내 옷장"} ${card.label}`}
                              className="h-full w-full object-cover"
                              fallbackSrc={card.fallbackSrc}
                              src={card.imageSrc}
                            />
                          </div>
                          <strong>{card.label}</strong>
                          <span>{compactUiText(card.title, 20)}</span>
                          {selectedTryOnSource === "system" ? (
                            <div className="flex gap-2">
                              <button
                                className="ui-button-secondary px-3 py-2"
                                disabled={
                                  index === 0 ||
                                  selectedTryOnCards[index - 1]?.layerOrder !== card.layerOrder
                                }
                                onClick={() => handleMoveSelectedCard(card.id, -1)}
                                type="button"
                              >
                                위로
                              </button>
                              <button
                                className="ui-button-secondary px-3 py-2"
                                disabled={
                                  index === selectedTryOnCards.length - 1 ||
                                  selectedTryOnCards[index + 1]?.layerOrder !== card.layerOrder
                                }
                                onClick={() => handleMoveSelectedCard(card.id, 1)}
                                type="button"
                              >
                                아래로
                              </button>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                    <div className="result-try-on-modal-summary">
                      <strong>실착 대상</strong>
                      <span>
                        {selectedTryOnCards.length > 0
                          ? selectedTryOnCards
                              .map((card) => `${card.label}: ${card.title}`)
                              .join(" / ")
                          : "실착 대상 이미지가 필요합니다."}
                      </span>
                      <small>
                        {selectedTryOnSource === "system" ? "시스템 추천 조합 전체" : "내 옷장 조합 전체"}
                      </small>
                    </div>
                    <button
                      className="ui-button-accent justify-between py-4"
                      onClick={() => void handleGenerateTryOn()}
                      type="button"
                    >
                      <span>실착 생성 시작</span>
                      <span>→</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {isTryOnViewerOpen && tryOnPreview ? (
            <div className="result-modal-backdrop" role="presentation">
              <div
                aria-label="실착 결과 보기"
                aria-modal="true"
                className="result-modal result-viewer-modal"
                role="dialog"
              >
                <div className="result-modal-header">
                  <div>
                    <p className="poster-kicker">Try On Result</p>
                    <h2>실착 결과 보기</h2>
                  </div>
                  <button
                    className="result-modal-close"
                    onClick={() => setIsTryOnViewerOpen(false)}
                    type="button"
                  >
                    닫기
                  </button>
                </div>
                <div className="result-viewer-surface">
                  <Image
                    alt="실착 결과 전체 보기"
                    className="h-full w-full object-contain"
                    fill
                    sizes="100vw"
                    src={tryOnPreview.preview_image}
                    unoptimized
                  />
                </div>
                <p className="result-try-on-message">
                  {tryOnPreview.provider === "vertex"
                    ? `${tryOnPreview.credits_charged ?? 1} 크레딧 차감`
                    : tryOnPreview.message}
                </p>
                {tryOnPreview.review_required ? (
                  <div className="result-try-on-review-note">
                    <strong>검토 필요</strong>
                    <span>{tryOnPreview.review_reason ?? "부분 반영 가능성이 높은 조합입니다."}</span>
                  </div>
                ) : null}
                {tryOnPreview.visibility_guidance ? (
                  <p className="result-try-on-visibility-note">{tryOnPreview.visibility_guidance}</p>
                ) : null}
                {previewStageItems.length > 0 ? (
                  <div className="result-try-on-stage-board">
                    <strong>합성 단계</strong>
                    <div className="result-try-on-stage-grid">
                      {previewStageItems.map((stage) => (
                        <article className="result-try-on-stage-card" key={stage.key}>
                          <div className="result-try-on-stage-image">
                            <Image
                              alt={`실착 합성 ${stage.step}단계`}
                              className="h-full w-full object-cover"
                              fill
                              sizes="(max-width: 768px) 33vw, 120px"
                              src={stage.preview_image}
                              unoptimized
                            />
                          </div>
                          <span>{stage.step}단계</span>
                          <strong>{stage.label ?? "중간 결과"}</strong>
                          {stage.retry_attempted ? (
                            <small
                              className={`result-try-on-stage-badge ${
                                stage.auto_corrected
                                  ? "result-try-on-stage-badge-success"
                                  : "result-try-on-stage-badge-warning"
                              }`}
                            >
                              {stage.auto_corrected ? "자동 보정됨" : "보정 실패"}
                            </small>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
                {previewRequestedItems.length > 0 ? (
                  <div className="result-try-on-requested-board">
                    <strong>요청 조합</strong>
                    <div className="result-try-on-requested-grid">
                      {previewRequestedItems.map((item) => (
                        <article className="result-try-on-requested-card" key={item.key}>
                          <div className="result-try-on-requested-image">
                            <SafePreviewImage
                              alt={`실착 요청 ${item.label}`}
                              className="h-full w-full object-cover"
                              fallbackSrc={item.fallback_src}
                              src={item.image_src}
                            />
                          </div>
                          <span>{item.label}</span>
                          <strong>{compactUiText(item.title, 16)}</strong>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
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
