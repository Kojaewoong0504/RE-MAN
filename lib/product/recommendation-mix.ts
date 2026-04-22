import type {
  AgentClosetItem,
  AgentClosetItemCategory,
  ClosetStrategy,
  RecommendationMix,
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

  return Array.from(selected.values());
}

export function buildHybridRecommendation(
  input: BuildHybridRecommendationInput
): {
  recommendation_mix: RecommendationMix;
  system_recommendations: SystemRecommendation[];
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
    system_recommendations: buildSystemRecommendations(missingCategories)
  };
}
