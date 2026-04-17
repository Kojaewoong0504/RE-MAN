import { describe, expect, it } from "vitest";
import { buildTodayActionPlan } from "@/lib/product/today-action-plan";

describe("today action plan", () => {
  it("turns a recommended outfit and action into three executable steps", () => {
    const plan = buildTodayActionPlan({
      todayAction: "셔츠를 넣어 입은 버전과 빼서 입은 버전을 거울 앞에서 비교하세요.",
      recommendedItems: ["네이비 셔츠", "검정 슬랙스", "흰색 스니커즈"]
    });

    expect(plan.summary).toBe("셔츠를 넣어 입은 버전과 빼서 입은 버전을 거울 앞에서 비교하세요.");
    expect(plan.steps).toEqual([
      {
        title: "추천 상의 꺼내기",
        detail: "네이비 셔츠 준비"
      },
      {
        title: "하의와 신발 같이 입기",
        detail: "검정 슬랙스 + 흰색 스니커즈"
      },
      {
        title: "거울 앞에서 사진 비교하기",
        detail: "전/후 버전을 같은 자세로 확인"
      }
    ]);
  });

  it("uses safe fallback labels when outfit items are generic", () => {
    const plan = buildTodayActionPlan({
      todayAction: "",
      recommendedItems: ["", "", ""]
    });

    expect(plan.summary).toBe("추천 조합을 입고 거울 앞에서 비교하세요.");
    expect(plan.steps[0].detail).toBe("추천 상의 준비");
    expect(plan.steps[1].detail).toBe("추천 하의 + 추천 신발");
  });
});
