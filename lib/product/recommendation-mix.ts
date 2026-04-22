import type {
  AgentClosetItem,
  AgentClosetItemCategory,
  ClosetStrategy,
  PrimaryOutfit,
  RecommendationMix,
  SelectableRecommendation,
  SurveyInput,
  SystemRecommendation
} from "@/lib/agents/contracts";
import { SYSTEM_STYLE_LIBRARY } from "@/lib/product/system-style-library";

type SourceItemIdMap = Partial<Record<AgentClosetItemCategory, string>>;

export type BuildHybridRecommendationInput = {
  survey: SurveyInput;
  closetItems: AgentClosetItem[];
  closetStrategy?: ClosetStrategy;
  verifiedSourceItemIds: SourceItemIdMap;
};

const REQUIRED_RECOMMENDATION_CATEGORIES: AgentClosetItemCategory[] = [
  "tops",
  "bottoms",
  "shoes"
];

const PHASE_ONE_SUPPORT_CATEGORIES: AgentClosetItemCategory[] = [
  "outerwear",
  "hats",
  "bags"
];

function getMissingCategories(closetItems: AgentClosetItem[]) {
  const available = new Set(closetItems.map((item) => item.category));

  return REQUIRED_RECOMMENDATION_CATEGORIES.filter(
    (category) => !available.has(category)
  );
}

function countVerifiedSourceItems(verifiedSourceItemIds: SourceItemIdMap) {
  return Object.values(verifiedSourceItemIds).filter(
    (value) => typeof value === "string" && value.trim().length > 0
  ).length;
}

function getClosetConfidence(input: {
  missingCategories: AgentClosetItemCategory[];
  coreCount: number;
  verifiedCount: number;
}): RecommendationMix["closet_confidence"] {
  if (input.missingCategories.length > 0 || input.coreCount === 0) {
    return "low";
  }

  if (input.verifiedCount >= 2 && input.coreCount >= 2) {
    return "high";
  }

  return "medium";
}

function buildSummary(input: {
  primarySource: RecommendationMix["primary_source"];
  missingCategories: AgentClosetItemCategory[];
}) {
  if (input.primarySource === "system") {
    return "시스템 추천을 먼저 보고 지금 옷장에 맞는 방향을 다시 좁혀갑니다.";
  }

  if (input.missingCategories.length > 0) {
    return `${input.missingCategories.join(", ")} 카테고리는 시스템 추천으로 보강합니다.`;
  }

  return "주 조합은 옷장 기준으로 구성하고 시스템 추천은 보조로 제공합니다.";
}

function buildSystemRecommendations(
  missingCategories: AgentClosetItemCategory[]
): SystemRecommendation[] {
  const preferredCategories =
    missingCategories.length > 0 ? missingCategories : REQUIRED_RECOMMENDATION_CATEGORIES;
  const selected = new Map<AgentClosetItemCategory, SystemRecommendation>();

  for (const category of preferredCategories) {
    const match = SYSTEM_STYLE_LIBRARY.find((item) => item.category === category);

    if (match) {
      selected.set(category, match);
    }
  }

  for (const category of REQUIRED_RECOMMENDATION_CATEGORIES) {
    if (selected.has(category)) {
      continue;
    }

    const match = SYSTEM_STYLE_LIBRARY.find((item) => item.category === category);

    if (match) {
      selected.set(category, match);
    }
  }

  for (const category of PHASE_ONE_SUPPORT_CATEGORIES) {
    if (selected.has(category)) {
      continue;
    }

    const match = SYSTEM_STYLE_LIBRARY.find((item) => item.category === category);

    if (match) {
      selected.set(category, match);
    }
  }

  return Array.from(selected.values());
}

function toSelectableRecommendation(
  item: SystemRecommendation
): SelectableRecommendation | null {
  if (!item.role) {
    return null;
  }

  return {
    ...item,
    role: item.role,
    compatibility_tags: item.compatibility_tags,
    layer_order_default: item.layer_order_default
  };
}

function buildSelectableRecommendations(
  missingCategories: AgentClosetItemCategory[]
): SelectableRecommendation[] {
  const preferredCoreCategories =
    missingCategories.length > 0
      ? [
          ...missingCategories,
          ...REQUIRED_RECOMMENDATION_CATEGORIES.filter(
            (category) => !missingCategories.includes(category)
          )
        ]
      : REQUIRED_RECOMMENDATION_CATEGORIES;

  const selectedIds = new Set<string>();
  const result: SelectableRecommendation[] = [];

  for (const category of preferredCoreCategories) {
    const match = SYSTEM_STYLE_LIBRARY.find(
      (item) => item.category === category && item.role
    );
    const selectable = match ? toSelectableRecommendation(match) : null;

    if (selectable && !selectedIds.has(selectable.id)) {
      selectedIds.add(selectable.id);
      result.push(selectable);
    }
  }

  for (const category of PHASE_ONE_SUPPORT_CATEGORIES) {
    const match = SYSTEM_STYLE_LIBRARY.find(
      (item) => item.category === category && item.role
    );
    const selectable = match ? toSelectableRecommendation(match) : null;

    if (selectable && !selectedIds.has(selectable.id)) {
      selectedIds.add(selectable.id);
      result.push(selectable);
    }
  }

  return result;
}

function buildPrimaryOutfit(
  selectableRecommendations: SelectableRecommendation[]
): PrimaryOutfit {
  const requiredRoles: Array<SelectableRecommendation["role"]> = [
    "base_top",
    "bottom",
    "shoes"
  ];
  const requiredItems = requiredRoles
    .map((role) => selectableRecommendations.find((item) => item.role === role))
    .filter((item): item is SelectableRecommendation => Boolean(item));

  const supportItem =
    selectableRecommendations.find((item) => item.role === "outerwear") ??
    selectableRecommendations.find((item) => item.role === "addon");
  const itemIds = [...requiredItems.map((item) => item.id)];

  if (supportItem && !itemIds.includes(supportItem.id)) {
    itemIds.push(supportItem.id);
  }

  return {
    title: requiredItems.length >= 3 ? "기본 추천 조합" : "추천 시작 조합",
    item_ids: itemIds,
    reason:
      requiredItems.length >= 3
        ? "상의, 하의, 신발의 기본 축을 먼저 맞추고 보조 아이템으로 분위기를 더합니다."
        : "현재 가능한 후보 안에서 바로 조합을 시작할 수 있는 기본 축입니다."
  };
}

export function buildHybridRecommendation(
  input: BuildHybridRecommendationInput
): {
  recommendation_mix: RecommendationMix;
  system_recommendations: SystemRecommendation[];
  primary_outfit: PrimaryOutfit;
  selectable_recommendations: SelectableRecommendation[];
} {
  const missingCategories = getMissingCategories(input.closetItems);
  const coreCount = input.closetStrategy?.core_item_ids.length ?? 0;
  const verifiedCount = countVerifiedSourceItems(input.verifiedSourceItemIds);
  const closetConfidence = getClosetConfidence({
    missingCategories,
    coreCount,
    verifiedCount
  });
  const primarySource = closetConfidence === "low" ? "system" : "closet";
  const systemRecommendations = buildSystemRecommendations(missingCategories);
  const selectableRecommendations = buildSelectableRecommendations(missingCategories);
  const primaryOutfit = buildPrimaryOutfit(selectableRecommendations);

  return {
    recommendation_mix: {
      primary_source: primarySource,
      closet_confidence: closetConfidence,
      system_support_needed:
        closetConfidence !== "high" || missingCategories.length > 0,
      missing_categories: missingCategories,
      summary: buildSummary({
        primarySource,
        missingCategories
      })
    },
    system_recommendations: systemRecommendations,
    primary_outfit: primaryOutfit,
    selectable_recommendations: selectableRecommendations
  };
}
