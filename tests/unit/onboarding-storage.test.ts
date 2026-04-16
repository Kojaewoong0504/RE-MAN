import { describe, expect, it } from "vitest";
import {
  buildClosetProfileFromItems,
  buildOnboardingRequest,
  buildHistoryFromState,
  getRecentHistoryPreview,
  getStyleFeedbackTimeline,
  mergePersistedProgramState,
  normalizeClosetItems,
  normalizeRecommendationFeedback,
  normalizeSizeProfile,
  type OnboardingState
} from "@/lib/onboarding/storage";

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

const baseDeepDiveFeedback = {
  title: "핏 체크",
  diagnosis: "상의 길이를 먼저 봅니다.",
  focus_points: ["상의", "하의", "신발"] as [string, string, string],
  recommendation: "상의 길이를 비교하세요.",
  action: "거울 앞에서 비교하세요."
};

const baseTryOnPreview = {
  cache_key: "cache-1",
  source: "reference" as const,
  reference_id: "recommended",
  prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기",
  provider: "vertex" as const,
  preview_image: "data:image/png;base64,result",
  message: "실착 결과",
  created_at: "2026-04-14T00:00:00.000Z"
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
      deep_dive_feedbacks: {
        fit: {
          ...baseDeepDiveFeedback,
          title: "remote fit"
        }
      },
      try_on_previews: {
        "remote-cache": {
          ...baseTryOnPreview,
          cache_key: "remote-cache"
        }
      },
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
    expect(merged.deep_dive_feedbacks?.fit?.title).toBe("remote fit");
    expect(merged.try_on_previews?.["remote-cache"]?.provider).toBe("vertex");
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
      },
      deep_dive_feedbacks: {
        closet: {
          ...baseDeepDiveFeedback,
          title: "local closet"
        }
      },
      try_on_previews: {
        "local-cache": {
          ...baseTryOnPreview,
          cache_key: "local-cache",
          message: "local try-on"
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
      deep_dive_feedbacks: {
        color: {
          ...baseDeepDiveFeedback,
          title: "remote color"
        }
      },
      try_on_previews: {
        "remote-cache": {
          ...baseTryOnPreview,
          cache_key: "remote-cache",
          message: "remote try-on"
        }
      },
      feedback: current.feedback
    };

    const merged = mergePersistedProgramState(current, persisted);

    expect(merged.daily_feedbacks?.["3"]?.diagnosis).toBe("Day 3 diagnosis");
    expect(merged.deep_dive_feedbacks?.closet?.title).toBe("local closet");
    expect(merged.deep_dive_feedbacks?.color?.title).toBe("remote color");
    expect(merged.try_on_previews?.["local-cache"]?.message).toBe("local try-on");
    expect(merged.try_on_previews?.["remote-cache"]?.message).toBe("remote try-on");
    expect(merged.survey.current_style).toBe("remote style");
  });
});

describe("closet item modeling", () => {
  it("normalizes closet items and builds agent-ready closet profile", () => {
    const items = normalizeClosetItems([
      {
        id: "top-1",
        category: "tops",
        name: "무지 티셔츠",
        photo_data_url: "data:image/jpeg;base64,closet",
        color: "흰색",
        fit: "레귤러",
        size: "L",
        wear_state: "잘 맞음",
        notes: "자주 입음"
      },
      {
        id: "bottom-1",
        category: "bottoms",
        name: "검정 슬랙스",
        color: "검정"
      },
      {
        id: "bad-1",
        category: "unknown",
        name: "무시"
      }
    ]);

    expect(items).toHaveLength(2);
    expect(items[0].photo_data_url).toBe("data:image/jpeg;base64,closet");

    const profile = buildClosetProfileFromItems(items, "너무 튀는 색");

    expect(profile.tops).toContain("흰색 무지 티셔츠");
    expect(profile.tops).toContain("레귤러");
    expect(profile.tops).toContain("[L]");
    expect(profile.tops).toContain("{잘 맞음}");
    expect(profile.bottoms).toContain("검정 슬랙스");
    expect(profile.avoid).toBe("너무 튀는 색");
  });

  it("uses closet items in onboarding payload before legacy closet text", () => {
    const request = buildOnboardingRequest({
      survey: baseSurvey,
      image: "data:image/png;base64,test",
      feedback_history: [{ day: 1, summary: "이전 진단", action: "이전 행동" }],
      closet_profile: {
        tops: "후드티",
        bottoms: "",
        shoes: "",
        avoid: "꽉 끼는 옷"
      },
      closet_items: [
        {
          id: "top-1",
          category: "tops",
          name: "셔츠",
          photo_data_url: "data:image/jpeg;base64,closet",
          color: "네이비",
          size: "L",
          wear_state: "잘 맞음"
        }
      ]
    });

    expect(request?.closet_profile?.tops).toContain("네이비 셔츠");
    expect(request?.closet_profile?.tops).toContain("[L]");
    expect(request?.closet_items?.[0]?.id).toBe("top-1");
    expect(request?.closet_items?.[0]).not.toHaveProperty("photo_data_url");
    expect(request?.closet_profile?.tops).not.toContain("후드티");
    expect(request?.closet_profile?.avoid).toBe("꽉 끼는 옷");
    expect(request?.feedback_history[0].summary).toBe("이전 진단");
  });
});

describe("size profile modeling", () => {
  it("normalizes user-entered size profile fields", () => {
    const profile = normalizeSizeProfile({
      height_cm: " 175 ",
      weight_kg: "72",
      top_size: " l ",
      bottom_size: "",
      shoe_size_mm: "270",
      unknown: "ignored"
    });

    expect(profile).toEqual({
      height_cm: "175",
      weight_kg: "72",
      top_size: "l",
      shoe_size_mm: "270"
    });
  });

  it("preserves local size profile over persisted state when local has a signal", () => {
    const current: OnboardingState = {
      user_id: "user-size",
      survey: baseSurvey,
      size_profile: {
        top_size: "L"
      }
    };
    const persisted: OnboardingState = {
      user_id: "user-size",
      survey: baseSurvey,
      size_profile: {
        top_size: "M",
        shoe_size_mm: "270"
      }
    };

    const merged = mergePersistedProgramState(current, persisted);

    expect(merged.size_profile?.top_size).toBe("L");
    expect(merged.size_profile?.shoe_size_mm).toBeUndefined();
  });
});

describe("recommendation feedback", () => {
  it("normalizes user reaction feedback", () => {
    expect(
      normalizeRecommendationFeedback({
        reaction: "helpful",
        note: "  셔츠 방향이 좋음 ",
        outfit_title: "기본 조합",
        created_at: "2026-04-15T00:00:00.000Z"
      })
    ).toEqual({
      reaction: "helpful",
      note: "셔츠 방향이 좋음",
      outfit_title: "기본 조합",
      created_at: "2026-04-15T00:00:00.000Z"
    });
  });

  it("adds user reaction into the saved feedback timeline", () => {
    const timeline = getStyleFeedbackTimeline({
      survey: baseSurvey,
      feedback: {
        diagnosis: "최근 스타일 체크 진단",
        improvements: ["a", "b", "c"],
        recommended_outfit: baseRecommendedOutfit,
        today_action: "오늘 액션",
        day1_mission: "다음 초점"
      },
      recommendation_feedback: {
        reaction: "not_sure",
        note: "신발은 애매함",
        outfit_title: baseRecommendedOutfit.title,
        created_at: "2026-04-15T00:00:00.000Z"
      }
    });

    expect(timeline[0].summary).toContain("내 반응: 애매함");
  });

  it("adds user reaction into the next agent feedback history", () => {
    const history = buildHistoryFromState({
      survey: baseSurvey,
      feedback: {
        diagnosis: "기본 조합은 좋지만 색 대비가 약합니다",
        improvements: ["a", "b", "c"],
        recommended_outfit: baseRecommendedOutfit,
        today_action: "오늘 액션",
        day1_mission: "다음 초점"
      },
      recommendation_feedback: {
        reaction: "save_for_later",
        note: "신발은 나중에 다시 보고 싶음",
        outfit_title: baseRecommendedOutfit.title,
        created_at: "2026-04-15T00:00:00.000Z"
      }
    });

    expect(history[0].summary).toContain("내 반응: 나중에 다시 보기");
    expect(history[0].summary).toContain("신발은 나중에");
  });
});

describe("onboarding feedback history", () => {
  it("stores and renders compact history previews", () => {
    const longDiagnosis =
      "지금은 편안한 검정 티셔츠와 바지 조합으로 집이나 동네에서 편하게 입는 스타일을 즐겨 입으시는 것 같아요. 전체적으로는 안정적이지만 변화 지점이 필요합니다.";
    const longAction =
      "오늘 저녁에 옷장을 한번 쭉 둘러보면서 내가 어떤 색깔의 옷을 가장 많이 가지고 있는지 확인해보세요.";

    const state: OnboardingState = {
      survey: baseSurvey,
      feedback: {
        diagnosis: longDiagnosis,
        improvements: ["a", "b", "c"],
        recommended_outfit: baseRecommendedOutfit,
        today_action: longAction,
        day1_mission: "내일은 평소에 잘 안 입던 티셔츠를 꺼내 입어보세요."
      },
      daily_feedbacks: {
        "2": {
          diagnosis: longDiagnosis,
          improvements: ["d", "e", "f"],
          today_action: longAction,
          tomorrow_preview: "내일은 거울 앞에서 자신감을 확인해보세요."
        }
      }
    };

    const history = buildHistoryFromState(state);

    expect(history).toHaveLength(2);
    expect(history[0].summary.length).toBeLessThanOrEqual(64);
    expect(history[0].action?.length).toBeLessThanOrEqual(64);

    const preview = getRecentHistoryPreview({
      ...state,
      feedback_history: [
        {
          day: 1,
          summary: `${longDiagnosis} / 실행: ${longAction} / 다음 초점: 내일은 다른 조합 확인`
        }
      ]
    });

    expect(preview[0]).toContain("Day 1:");
    expect(preview[0].length).toBeLessThan(120);
    expect(preview[0]).not.toContain("다음 초점");
  });

  it("builds a readable profile feedback timeline", () => {
    const timeline = getStyleFeedbackTimeline({
      survey: baseSurvey,
      feedback: {
        diagnosis: "최근 스타일 체크 진단",
        improvements: ["a", "b", "c"],
        recommended_outfit: {
          ...baseRecommendedOutfit,
          source_item_ids: {
            tops: "timeline-top",
            bottoms: "timeline-bottom",
            shoes: "timeline-shoes"
          }
        },
        today_action: "오늘 액션",
        day1_mission: "다음 초점"
      },
      closet_items: [
        {
          id: "timeline-top",
          category: "tops",
          name: "네이비 셔츠",
          color: "네이비",
          size: "L"
        },
        {
          id: "timeline-bottom",
          category: "bottoms",
          name: "검정 슬랙스",
          color: "검정",
          size: "32"
        },
        {
          id: "timeline-shoes",
          category: "shoes",
          name: "흰색 스니커즈",
          color: "흰색",
          size: "270"
        }
      ],
      recommendation_feedback: {
        reaction: "helpful",
        note: "셔츠 방향 좋음",
        outfit_title: baseRecommendedOutfit.title,
        created_at: "2026-04-16T00:00:00.000Z"
      },
      deep_dive_feedbacks: {
        fit: baseDeepDiveFeedback
      }
    });

    expect(timeline).toHaveLength(2);
    expect(timeline[0].label).toBe("Style Check");
    expect(timeline[0].summary).toContain("최근 스타일 체크 진단");
    expect(timeline[0].summary).toContain("내 반응: 도움됨");
    expect(timeline[0].reaction).toBe("도움됨");
    expect(timeline[0].reactionNote).toBe("셔츠 방향 좋음");
    expect(timeline[0].basis?.map((item) => item.itemName)).toEqual([
      "네이비 셔츠",
      "검정 슬랙스",
      "흰색 스니커즈"
    ]);
    expect(timeline[1].label).toBe("Deep Dive");
    expect(timeline[1].title).toBe("핏 체크");
  });
});
