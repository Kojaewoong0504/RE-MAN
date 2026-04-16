import type { ClosetItem, ClosetItemCategory } from "@/lib/onboarding/storage";

export type ClosetBasisMatchStatus = "matched" | "fallback" | "optional";

export type ClosetBasisItem = {
  category: ClosetItemCategory;
  label: string;
  itemName: string;
  role: string;
  matchStatus: ClosetBasisMatchStatus;
  size?: string;
  wearState?: string;
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
  matchStatus: ClosetBasisMatchStatus
): ClosetBasisItem {
  return {
    category: item.category,
    label: closetCategoryLabels[item.category],
    itemName: getClosetItemDisplayName(item),
    role: closetCategoryRoles[item.category],
    matchStatus,
    size: item.size || undefined,
    wearState: item.wear_state || undefined
  };
}

export function buildClosetBasisMatches(input: {
  closetItems: ClosetItem[];
  recommendedItems: [string, string, string];
  sourceItemIds?: Partial<Record<ClosetItemCategory, string>>;
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
      basis.push(toBasisItem(sourceItem ?? categoryItems[0], sourceItem ? "matched" : "optional"));
      return;
    }

    const sourceItemId = input.sourceItemIds?.[category];
    const sourceItem = sourceItemId
      ? categoryItems.find((item) => item.id === sourceItemId)
      : null;

    if (sourceItem) {
      basis.push(toBasisItem(sourceItem, "matched"));
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

    basis.push(toBasisItem(best.item, best.score > 0 ? "matched" : "fallback"));
  });

  return basis;
}
