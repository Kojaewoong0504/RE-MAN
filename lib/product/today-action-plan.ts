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

export function buildTodayActionPlan(input: {
  todayAction?: string;
  recommendedItems: [string, string, string];
}): TodayActionPlan {
  const top = cleanItemLabel(input.recommendedItems[0], "추천 상의");
  const bottom = cleanItemLabel(input.recommendedItems[1], "추천 하의");
  const shoes = cleanItemLabel(input.recommendedItems[2], "추천 신발");
  const summary =
    input.todayAction?.replace(/\s+/g, " ").trim() ||
    "추천 조합을 입고 거울 앞에서 비교하세요.";

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
