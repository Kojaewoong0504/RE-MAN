import { describe, expect, it } from "vitest";
import { mergePersistedProgramState, type OnboardingState } from "@/lib/onboarding/storage";

const baseSurvey = {
  current_style: "청바지 + 무지 티셔츠",
  motivation: "소개팅",
  budget: "15~30만원"
};

const baseRecommendedOutfit = {
  title: "기본 조합",
  items: ["상의", "하의", "신발"] as [string, string, string],
  reason: "지금 가진 옷으로 가능한 조합",
  try_on_prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
};

describe("onboarding state merge", () => {
  it("prefers a farther Firestore program state while preserving local image input", () => {
    const current: OnboardingState = {
      user_id: "user-1",
      email: "local@example.com",
      survey: baseSurvey,
      image: "data:image/png;base64,local",
      feedback: {
        diagnosis: "Day 1 diagnosis",
        improvements: ["a", "b", "c"],
        recommended_outfit: baseRecommendedOutfit,
        today_action: "오늘 액션",
        day1_mission: "Day 1 미션"
      }
    };
    const persisted: OnboardingState = {
      user_id: "user-1",
      email: "remote@example.com",
      survey: {
        current_style: "셔츠 + 슬랙스",
        motivation: "면접",
        budget: "30만원 이상"
      },
      feedback: current.feedback,
      daily_feedbacks: {
        "2": {
          diagnosis: "Day 2 diagnosis",
          improvements: ["d", "e", "f"],
          today_action: "Day 2 action",
          tomorrow_preview: "Day 3 focus"
        }
      },
      feedback_history: [{ day: 1, summary: "remote history" }]
    };

    const merged = mergePersistedProgramState(current, persisted);

    expect(merged.email).toBe("remote@example.com");
    expect(merged.survey.current_style).toBe("셔츠 + 슬랙스");
    expect(merged.daily_feedbacks?.["2"]?.diagnosis).toBe("Day 2 diagnosis");
    expect(merged.image).toBe("data:image/png;base64,local");
  });

  it("keeps a farther local state over an older Firestore state", () => {
    const current: OnboardingState = {
      user_id: "user-2",
      survey: baseSurvey,
      feedback: {
        diagnosis: "Day 1 diagnosis",
        improvements: ["a", "b", "c"],
        recommended_outfit: baseRecommendedOutfit,
        today_action: "오늘 액션",
        day1_mission: "Day 1 미션"
      },
      daily_feedbacks: {
        "3": {
          diagnosis: "Day 3 diagnosis",
          improvements: ["d", "e", "f"],
          today_action: "Day 3 action",
          tomorrow_preview: "Day 4 focus"
        }
      }
    };
    const persisted: OnboardingState = {
      user_id: "user-2",
      survey: {
        current_style: "remote style",
        motivation: "remote motivation",
        budget: "remote budget"
      },
      feedback: current.feedback
    };

    const merged = mergePersistedProgramState(current, persisted);

    expect(merged.daily_feedbacks?.["3"]?.diagnosis).toBe("Day 3 diagnosis");
    expect(merged.survey.current_style).toBe("remote style");
  });
});
