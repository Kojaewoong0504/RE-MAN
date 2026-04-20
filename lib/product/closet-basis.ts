import type { ClosetItem, ClosetItemCategory } from "@/lib/onboarding/storage";

export type ClosetBasisMatchStatus = "matched" | "fallback" | "optional";
export type ClosetBasisStrategyRole = "core" | "use_with_care" | "optional";

export type ClosetBasisStrategyItem = {
  id: string;
  category: ClosetItemCategory;
  role: ClosetBasisStrategyRole;
  reason: string;
  score?: number;
};

export type ClosetBasisItem = {
  category: ClosetItemCategory;
  label: string;
  itemName: string;
  role: string;
  matchStatus: ClosetBasisMatchStatus;
  statusLabel: string;
  signalLabel: string;
  verificationLabel: string;
  detailLabel: string;
  size?: string;
  wearState?: string;
};

export type ClosetBasisSummary = {
  countLabel: string;
  reasonLabel: string;
};

const closetCategoryLabels: Record<ClosetItemCategory, string> = {
  tops: "상의",
  bottoms: "하의",
  shoes: "신발",
  outerwear: "겉옷"
};

const closetCategoryRoles: Record<ClosetItemCategory, string> = {
  tops: "얼굴 주변 인상을 정하는 기준",
  bottoms: "전체 비율과 실루엣 기준",
  shoes: "코디가 흩어지지 않게 묶는 기준",
  outerwear: "추천 조합에 더할 수 있는 선택지"
};

const recommendationCategoryIndex: Partial<Record<ClosetItemCategory, number>> = {
  tops: 0,
  bottoms: 1,
  shoes: 2
};

const matchStatusLabels: Record<ClosetBasisMatchStatus, string> = {
  matched: "추천에 사용",
  fallback: "비슷한 후보",
  optional: "추가 후보"
};

const strategySignalLabels: Record<ClosetBasisStrategyRole, string> = {
  core: "자주 입고 잘 맞음",
  use_with_care: "핏/상태 확인",
  optional: "후보"
};

const verificationLabels: Record<ClosetBasisMatchStatus, string> = {
  matched: "옷장 ID 검증",
  fallback: "텍스트 후보",
  optional: "선택 후보"
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getClosetItemDisplayName(item: ClosetItem) {
  if (item.color && !item.name.includes(item.color)) {
    return `${item.color} ${item.name}`;
  }

  return item.name;
}

function getMatchScore(item: ClosetItem, recommendedText: string) {
  const target = normalizeText(recommendedText);
  const name = normalizeText(item.name);
  const color = normalizeText(item.color ?? "");

  let score = 0;

  if (name && target.includes(name)) {
    score += 2;
  }

  if (color && target.includes(color)) {
    score += 1;
  }

  return score;
}

function toBasisItem(
  item: ClosetItem,
  matchStatus: ClosetBasisMatchStatus,
  strategyItem?: ClosetBasisStrategyItem
): ClosetBasisItem {
  const detailParts = [item.size, item.wear_state].filter(Boolean);

  return {
    category: item.category,
    label: closetCategoryLabels[item.category],
    itemName: getClosetItemDisplayName(item),
    role: closetCategoryRoles[item.category],
    matchStatus,
    statusLabel: matchStatusLabels[matchStatus],
    signalLabel: strategyItem
      ? strategySignalLabels[strategyItem.role]
      : matchStatusLabels[matchStatus],
    verificationLabel: verificationLabels[matchStatus],
    detailLabel:
      detailParts.length > 0
        ? detailParts.join(" · ")
        : strategyItem?.reason ?? closetCategoryRoles[item.category],
    size: item.size || undefined,
    wearState: item.wear_state || undefined
  };
}

function findStrategyItem(
  strategyItems: ClosetBasisStrategyItem[] | undefined,
  item: ClosetItem
) {
  return strategyItems?.find(
    (strategyItem) =>
      strategyItem.id === item.id && strategyItem.category === item.category
  );
}

export function buildClosetBasisMatches(input: {
  closetItems: ClosetItem[];
  recommendedItems: [string, string, string];
  sourceItemIds?: Partial<Record<ClosetItemCategory, string>>;
  strategyItems?: ClosetBasisStrategyItem[];
}): ClosetBasisItem[] {
  const basis: ClosetBasisItem[] = [];
  const categories: ClosetItemCategory[] = ["tops", "bottoms", "shoes", "outerwear"];

  categories.forEach((category) => {
    const categoryItems = input.closetItems.filter((item) => item.category === category);

    if (categoryItems.length === 0) {
      return;
    }

    if (category === "outerwear") {
      const sourceItem = input.sourceItemIds?.outerwear
        ? categoryItems.find((item) => item.id === input.sourceItemIds?.outerwear)
        : null;
      const basisItem = sourceItem ?? categoryItems[0];
      basis.push(
        toBasisItem(
          basisItem,
          sourceItem ? "matched" : "optional",
          findStrategyItem(input.strategyItems, basisItem)
        )
      );
      return;
    }

    const sourceItemId = input.sourceItemIds?.[category];
    const sourceItem = sourceItemId
      ? categoryItems.find((item) => item.id === sourceItemId)
      : null;

    if (sourceItem) {
      basis.push(toBasisItem(sourceItem, "matched", findStrategyItem(input.strategyItems, sourceItem)));
      return;
    }

    const recommendationIndex = recommendationCategoryIndex[category];
    const recommendedText =
      typeof recommendationIndex === "number" ? input.recommendedItems[recommendationIndex] : "";
    const scoredItems = categoryItems
      .map((item) => ({
        item,
        score: getMatchScore(item, recommendedText)
      }))
      .sort((left, right) => right.score - left.score);
    const best = scoredItems[0];

    if (!best) {
      return;
    }

    basis.push(
      toBasisItem(
        best.item,
        best.score > 0 ? "matched" : "fallback",
        findStrategyItem(input.strategyItems, best.item)
      )
    );
  });

  return basis;
}

export function buildClosetBasisSummary(basis: ClosetBasisItem[]): ClosetBasisSummary {
  const primaryCategories: ClosetItemCategory[] = ["tops", "bottoms", "shoes"];
  const matchedCount = basis.filter(
    (item) =>
      primaryCategories.includes(item.category) && item.matchStatus === "matched"
  ).length;
  const reasonBasis =
    basis.find((item) => item.matchStatus === "matched") ?? basis[0];

  return {
    countLabel: `상의 · 하의 · 신발 중 ${matchedCount}개 반영`,
    reasonLabel: reasonBasis
      ? `${reasonBasis.itemName} 중심으로 시작`
      : "옷장을 등록하면 추천 근거가 더 선명해집니다"
  };
}
