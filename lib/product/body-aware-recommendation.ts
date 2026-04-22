import type {
  AgentClosetItem,
  BodyProfile,
  OutfitRecommendation,
  SurveyInput
} from "@/lib/agents/contracts";

type BuildBodyAwareRecommendationInput = {
  survey: SurveyInput;
  bodyProfile?: BodyProfile;
  closetItems: AgentClosetItem[];
};

function matchesCroppedTopRisk(item: AgentClosetItem) {
  if (item.category !== "tops") {
    return false;
  }

  return item.fit?.includes("크롭") || item.name.includes("짧");
}

function matchesSkinnyBottomRisk(item: AgentClosetItem) {
  if (item.category !== "bottoms") {
    return false;
  }

  return item.fit?.includes("슬림") || item.fit?.includes("스키니");
}

function buildAvoidNotes(bodyProfile?: BodyProfile): [string, string, string] {
  const notes: string[] = [];

  if (bodyProfile?.fit_risk_tags?.includes("cropped_top_risk")) {
    notes.push("짧은 상의는 제외");
  }

  if (bodyProfile?.fit_risk_tags?.includes("skinny_bottom_risk")) {
    notes.push("붙는 하의는 제외");
  }

  if (bodyProfile?.fit_risk_tags?.includes("strong_contrast_split_risk")) {
    notes.push("강한 상하 대비는 제외");
  }

  while (notes.length < 3) {
    notes.push("과한 포인트는 제외");
  }

  return [notes[0], notes[1], notes[2]];
}

function pickSafeItem(items: AgentClosetItem[], category: AgentClosetItem["category"]) {
  return items.find((item) => item.category === category);
}

export function buildBodyAwareRecommendation(
  input: BuildBodyAwareRecommendationInput
): {
  safeClosetItemIds: string[];
  rejectedClosetItemIds: string[];
  recommended_outfit: OutfitRecommendation;
} {
  const rejectedClosetItemIds = input.closetItems
    .filter((item) => {
      if (input.bodyProfile?.fit_risk_tags?.includes("cropped_top_risk") && matchesCroppedTopRisk(item)) {
        return true;
      }

      if (
        input.bodyProfile?.fit_risk_tags?.includes("skinny_bottom_risk") &&
        matchesSkinnyBottomRisk(item)
      ) {
        return true;
      }

      return false;
    })
    .map((item) => item.id);

  const safeItems = input.closetItems.filter((item) => !rejectedClosetItemIds.includes(item.id));
  const top = pickSafeItem(safeItems, "tops");
  const bottom = pickSafeItem(safeItems, "bottoms");
  const shoes = pickSafeItem(safeItems, "shoes");

  return {
    safeClosetItemIds: [top?.id, bottom?.id, shoes?.id].filter(Boolean) as string[],
    rejectedClosetItemIds,
    recommended_outfit: {
      title: "안전한 기본 조합",
      items: [top?.name ?? "상의", bottom?.name ?? "하의", shoes?.name ?? "신발"],
      reason: "현재 체형에서 시선이 과하게 몰리지 않고 가장 무난하게 정리되는 조합입니다.",
      safety_basis: [
        "상체를 과하게 키우지 않음",
        "하체 라인이 안정적으로 보임",
        "지금 옷장에서 바로 재현 가능"
      ],
      avoid_notes: buildAvoidNotes(input.bodyProfile),
      try_on_prompt:
        "전체 조합을 자연스럽게 적용하고 비율이 더 안정적으로 보이게 정리"
    }
  };
}
