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

const BRIGHT_COLOR_KEYWORDS = ["화이트", "흰", "아이보리", "크림", "베이지", "라이트"];
const DARK_COLOR_KEYWORDS = ["블랙", "검정", "네이비", "차콜", "다크", "먹색"];
const HEAVY_NECKLINE_KEYWORDS = ["터틀넥", "목폴라", "하이넥", "mock neck", "모크넥"];
const VOLUME_TOP_KEYWORDS = ["오버핏", "박시", "벌룬", "패딩", "두꺼운"];

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

function matchesHeavyNecklineRisk(item: AgentClosetItem) {
  if (item.category !== "tops") {
    return false;
  }

  const source = `${item.name} ${item.fit ?? ""}`.toLowerCase();
  return HEAVY_NECKLINE_KEYWORDS.some((keyword) => source.includes(keyword.toLowerCase()));
}

function matchesVolumeTopRisk(item: AgentClosetItem) {
  if (item.category !== "tops") {
    return false;
  }

  const source = `${item.name} ${item.fit ?? ""}`;
  return VOLUME_TOP_KEYWORDS.some((keyword) => source.includes(keyword));
}

function isBrightTone(item: AgentClosetItem) {
  const source = `${item.color ?? ""} ${item.name}`;
  return BRIGHT_COLOR_KEYWORDS.some((keyword) => source.includes(keyword));
}

function isDarkTone(item: AgentClosetItem) {
  const source = `${item.color ?? ""} ${item.name}`;
  return DARK_COLOR_KEYWORDS.some((keyword) => source.includes(keyword));
}

function formsStrongContrastSplit(
  item: AgentClosetItem,
  closetItems: AgentClosetItem[],
  bodyProfile?: BodyProfile
) {
  if (
    item.category !== "tops" ||
    !bodyProfile?.fit_risk_tags?.includes("strong_contrast_split_risk")
  ) {
    return false;
  }

  const bottoms = closetItems.filter((closetItem) => closetItem.category === "bottoms");

  if (bottoms.length === 0) {
    return false;
  }

  return bottoms.some((bottom) => {
    return (
      (isBrightTone(item) && isDarkTone(bottom)) ||
      (isDarkTone(item) && isBrightTone(bottom))
    );
  });
}

function buildAvoidNotes(bodyProfile?: BodyProfile): [string, string, string] {
  const notes: string[] = [];

  if (bodyProfile?.fit_risk_tags?.includes("cropped_top_risk")) {
    notes.push("짧은 상의는 제외");
  }

  if (bodyProfile?.fit_risk_tags?.includes("heavy_neckline_risk")) {
    notes.push("목을 덮는 상의는 제외");
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

function getTopScore(item: AgentClosetItem, bodyProfile?: BodyProfile) {
  let score = 0;

  if (item.wear_state?.includes("잘 맞")) {
    score += 3;
  }

  if (item.fit?.includes("레귤러")) {
    score += 2;
  }

  if (!matchesVolumeTopRisk(item)) {
    score += 1;
  }

  if (bodyProfile?.fit_risk_tags?.includes("strong_contrast_split_risk") && !isBrightTone(item)) {
    score += 2;
  }

  if (bodyProfile?.fit_risk_tags?.includes("heavy_neckline_risk") && !matchesHeavyNecklineRisk(item)) {
    score += 3;
  }

  if (
    bodyProfile?.overall_frame === "large" &&
    bodyProfile?.upper_body_presence === "high" &&
    !matchesVolumeTopRisk(item)
  ) {
    score += 2;
  }

  return score;
}

function getBottomScore(item: AgentClosetItem, bodyProfile?: BodyProfile) {
  let score = 0;

  if (item.wear_state?.includes("잘 맞")) {
    score += 3;
  }

  if (item.fit?.includes("테이퍼드") || item.fit?.includes("일자") || item.fit?.includes("레귤러")) {
    score += 3;
  }

  if (
    bodyProfile?.fit_risk_tags?.includes("strong_contrast_split_risk") &&
    !isBrightTone(item)
  ) {
    score += 2;
  }

  if (bodyProfile?.leg_length_impression === "shorter" && !isBrightTone(item)) {
    score += 2;
  }

  return score;
}

function getShoesScore(item: AgentClosetItem, bodyProfile?: BodyProfile) {
  let score = 0;

  if (item.wear_state?.includes("잘 맞")) {
    score += 2;
  }

  if (
    bodyProfile?.leg_length_impression === "shorter" &&
    !isBrightTone(item)
  ) {
    score += 2;
  }

  if (isDarkTone(item)) {
    score += 1;
  }

  return score;
}

function pickSafeItem(
  items: AgentClosetItem[],
  category: AgentClosetItem["category"],
  bodyProfile?: BodyProfile
) {
  const candidates = items.filter((item) => item.category === category);

  if (candidates.length === 0) {
    return undefined;
  }

  return [...candidates].sort((left, right) => {
    const leftScore =
      category === "tops"
        ? getTopScore(left, bodyProfile)
        : category === "bottoms"
          ? getBottomScore(left, bodyProfile)
          : getShoesScore(left, bodyProfile);
    const rightScore =
      category === "tops"
        ? getTopScore(right, bodyProfile)
        : category === "bottoms"
          ? getBottomScore(right, bodyProfile)
          : getShoesScore(right, bodyProfile);

    return rightScore - leftScore;
  })[0];
}

function buildSafetyBasis(
  bodyProfile: BodyProfile | undefined,
  selectedTop?: AgentClosetItem
): [string, string, string] {
  if (
    bodyProfile?.overall_frame === "large" &&
    bodyProfile?.belly_visibility === "high"
  ) {
    return [
      "상체를 과하게 키우지 않음",
      "하체 라인이 안정적으로 보임",
      "지금 옷장에서 바로 재현 가능"
    ];
  }

  if (
    bodyProfile?.fit_risk_tags?.includes("heavy_neckline_risk") &&
    bodyProfile?.fit_risk_tags?.includes("strong_contrast_split_risk") &&
    bodyProfile.leg_length_impression === "shorter"
  ) {
    return [
      "목선이 답답해 보이지 않음",
      "상하 밝기 차이가 과하지 않음",
      "다리 비율이 더 안정적으로 이어짐"
    ];
  }

  if (
    bodyProfile?.overall_frame === "large" &&
    bodyProfile?.upper_body_presence === "high" &&
    !matchesVolumeTopRisk(selectedTop ?? { category: "tops", id: "", name: "" })
  ) {
    return [
      "상체를 과하게 키우지 않음",
      "하체 라인이 안정적으로 보임",
      "지금 옷장에서 바로 재현 가능"
    ];
  }

  return [
    "실루엣이 과하게 부풀지 않음",
    "상하 비율이 안정적으로 이어짐",
    "지금 옷장에서 바로 재현 가능"
  ];
}

function buildReason(
  bodyProfile: BodyProfile | undefined,
  top?: AgentClosetItem,
  bottom?: AgentClosetItem
) {
  if (
    bodyProfile?.fit_risk_tags?.includes("heavy_neckline_risk") &&
    bodyProfile?.fit_risk_tags?.includes("strong_contrast_split_risk")
  ) {
    return `${top?.name ?? "상의"}와 ${bottom?.name ?? "하의"}를 가까운 톤으로 묶어 목선 답답함과 상하 분절감을 동시에 줄이는 조합입니다.`;
  }

  if (bodyProfile?.fit_risk_tags?.includes("cropped_top_risk")) {
    return "짧게 끊기는 상의 대신 안정적인 길이감의 상의를 써서 시선이 한곳에 몰리지 않게 정리한 조합입니다.";
  }

  return "현재 체형에서 시선이 과하게 몰리지 않고 가장 무난하게 정리되는 조합입니다.";
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

      if (
        input.bodyProfile?.fit_risk_tags?.includes("heavy_neckline_risk") &&
        matchesHeavyNecklineRisk(item)
      ) {
        return true;
      }

      if (formsStrongContrastSplit(item, input.closetItems, input.bodyProfile)) {
        return true;
      }

      return false;
    })
    .map((item) => item.id);

  const safeItems = input.closetItems.filter((item) => !rejectedClosetItemIds.includes(item.id));
  const top = pickSafeItem(safeItems, "tops", input.bodyProfile);
  const bottom = pickSafeItem(safeItems, "bottoms", input.bodyProfile);
  const shoes = pickSafeItem(safeItems, "shoes", input.bodyProfile);

  return {
    safeClosetItemIds: [top?.id, bottom?.id, shoes?.id].filter(Boolean) as string[],
    rejectedClosetItemIds,
    recommended_outfit: {
      title: "안전한 기본 조합",
      items: [top?.name ?? "상의", bottom?.name ?? "하의", shoes?.name ?? "신발"],
      reason: buildReason(input.bodyProfile, top, bottom),
      safety_basis: buildSafetyBasis(input.bodyProfile, top),
      avoid_notes: buildAvoidNotes(input.bodyProfile),
      try_on_prompt:
        "전체 조합을 자연스럽게 적용하고 비율이 더 안정적으로 보이게 정리"
    }
  };
}
