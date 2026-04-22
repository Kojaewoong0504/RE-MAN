export type TodayActionPlanStep = {
  title: string;
  detail: string;
};

export type TodayActionPlan = {
  summary: string;
  steps: [TodayActionPlanStep, TodayActionPlanStep, TodayActionPlanStep];
};

function cleanItemLabel(value: string, fallback: string) {
  const cleaned = value
    .replace(/\[[^\]]*]/g, "")
    .replace(/\{[^}]*}/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
}

function compactPlanSummary(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "추천 조합을 입고 거울 앞에서 비교하세요.";
  }

  if (normalized.length <= 42) {
    return normalized;
  }

  if (normalized.includes("소매") && normalized.includes("걷")) {
    return "티셔츠 소매를 걷고 전체 균형 확인";
  }

  if (normalized.includes("넣어 입") && normalized.includes("거울")) {
    return "넣어 입은 버전과 기본 버전 비교";
  }
  const firstSentence = normalized.split(/[.!?]/)[0]?.trim() || normalized;

  return `${firstSentence.slice(0, 41).trim()}…`;
}

export function buildTodayActionPlan(input: {
  todayAction?: string;
  recommendedItems: [string, string, string];
}): TodayActionPlan {
  const top = cleanItemLabel(input.recommendedItems[0], "추천 상의");
  const bottom = cleanItemLabel(input.recommendedItems[1], "추천 하의");
  const shoes = cleanItemLabel(input.recommendedItems[2], "추천 신발");
  const summary = compactPlanSummary(input.todayAction ?? "");

  return {
    summary,
    steps: [
      {
        title: "추천 상의 꺼내기",
        detail: `${top} 준비`
      },
      {
        title: "하의와 신발 같이 입기",
        detail: `${bottom} + ${shoes}`
      },
      {
        title: "거울 앞에서 사진 비교하기",
        detail: "전/후 버전을 같은 자세로 확인"
      }
    ]
  };
}
