import type {
  AgentRequest,
  DailyAgentResponse,
  DeepDiveRequest,
  DeepDiveResponse,
  OnboardingAgentResponse
} from "@/lib/agents/contracts";

const dayOneMission =
  "옷장에 있는 옷을 전부 꺼내서 바닥에 펼쳐보고, 어떤 조합이 많은지 먼저 확인해보세요.";

const tomorrowPreviewByDay: Record<number, string> = {
  2: "내일은 오늘 코디에서 딱 한 가지만 바꿔볼게요.",
  3: "내일은 비율이 먼저 보이도록 상의와 하의 길이감을 다시 볼게요.",
  4: "내일은 신발과 하의 연결이 자연스러운지 집중해서 볼게요.",
  5: "내일은 컬러가 흩어지지 않도록 톤 정리를 해볼게요.",
  6: "내일은 지금까지 바꾼 것 중 가장 효과 있었던 한 가지를 고정해볼게요.",
  7: "오늘이 마지막이니, 처음보다 무엇이 또렷해졌는지 정리해볼게요."
};

function getFirstClosetItemIdByCategory(payload: AgentRequest) {
  return (["tops", "bottoms", "shoes", "outerwear"] as const).reduce<
    NonNullable<OnboardingAgentResponse["recommended_outfit"]["source_item_ids"]>
  >((acc, category) => {
    const strategyItem =
      payload.closet_strategy?.items.find(
        (item) => item.category === category && item.role === "core"
      ) ??
      payload.closet_strategy?.items.find(
        (item) => item.category === category && item.role === "optional"
      ) ??
      payload.closet_strategy?.items.find((item) => item.category === category);
    const item =
      (strategyItem
        ? payload.closet_items?.find((closetItem) => closetItem.id === strategyItem.id)
        : undefined) ??
      payload.closet_items?.find((closetItem) => closetItem.category === category);

    if (item) {
      acc[category] = item.id;
    }

    return acc;
  }, {});
}

export function buildMockOnboardingFeedback(
  payload: AgentRequest
): OnboardingAgentResponse {
  const style = payload.survey.current_style;
  const goal = payload.survey.style_goal || "전체적인 스타일 개선";
  const confidence = payload.survey.confidence_level || "미입력";
  const preference = payload.preference_profile;
  const preferenceReason = preference?.avoid_direction
    ? ` 이전 반응에서 애매하다고 남긴 ${preference.avoid_direction}은 반복하지 않는 쪽이 좋습니다.`
    : preference?.liked_direction
      ? ` 이전에 좋다고 남긴 ${preference.liked_direction}은 유지해도 괜찮습니다.`
      : "";
  const coreCount = payload.closet_strategy?.core_item_ids.length ?? 0;
  const closetReason = coreCount
    ? ` 옷장 메모에서 기본템으로 분류된 ${coreCount}개를 먼저 기준으로 잡았습니다.`
    : "";

  return {
    diagnosis: `${style} 중심의 코디라 편한 인상은 있지만, ${goal} 목표와 현재 자신감(${confidence})을 기준으로 보면 실루엣과 레이어가 아직 약합니다.`,
    improvements: [
      "바지 핏을 조금 더 곧게 잡으면 전체 인상이 훨씬 정리돼 보여요.",
      "상의에 얇은 겉옷이나 셔츠 하나만 추가해도 단조로운 느낌이 줄어요.",
      "신발 톤을 상의나 하의와 맞추면 코디가 덜 흩어져 보여요."
    ],
    recommended_outfit: {
      title: "지금 가진 옷으로 만드는 깔끔한 기본 조합",
      items: [
        payload.closet_profile?.tops || "가장 깔끔한 무지 상의",
        payload.closet_profile?.bottoms || "주름이 적은 일자핏 바지",
        payload.closet_profile?.shoes || "상의나 바지와 톤이 맞는 신발"
      ],
      reason:
        `${goal}에는 새로 사기보다 지금 가진 옷 중 실루엣이 가장 단정한 조합을 먼저 고르는 편이 변화가 바로 보입니다.${closetReason}${preferenceReason}`,
      try_on_prompt:
        "전신 정면 사진을 기준으로 무지 상의, 일자핏 바지, 톤이 맞는 신발을 자연스럽게 착용한 미리보기",
      source_item_ids: getFirstClosetItemIdByCategory(payload)
    },
    today_action:
      "지금 가진 옷 중 가장 깔끔한 상의와 바지를 한 번 다시 조합해서 거울로 비교해보세요.",
    day1_mission: dayOneMission
  };
}

export function buildMockDailyFeedback(payload: AgentRequest): DailyAgentResponse {
  const lastDay = payload.feedback_history.at(-1)?.day ?? 1;
  const currentDay = Math.min(lastDay + 1, 7);

  return {
    diagnosis: `Day ${lastDay}보다 오늘 코디가 더 정돈돼 보이고, 핵심 아이템이 눈에 더 잘 들어옵니다.`,
    improvements: [
      "상의 길이감만 조금 더 정리되면 비율이 더 좋아 보여요.",
      "바지 주름이나 밑단만 다듬어도 인상이 훨씬 또렷해져요.",
      "신발 톤을 조금 더 가볍게 맞추면 전체 무드가 덜 무거워져요."
    ],
    today_action:
      "지금 가진 신발 중 가장 단정한 한 켤레로 바꿔서 다시 사진을 비교해보세요.",
    tomorrow_preview:
      tomorrowPreviewByDay[currentDay] ??
      "내일은 오늘 코디에서 딱 한 가지만 바꿔볼게요."
  };
}

export function buildMockDeepDiveFeedback(payload: DeepDiveRequest): DeepDiveResponse {
  if (payload.module === "color") {
    return {
      title: "색 조합 체크",
      diagnosis: `${payload.survey.current_style} 기준으로 보면 색이 크게 튀지는 않지만, 상의와 신발 톤이 따로 보이면 전체 인상이 덜 정돈돼 보일 수 있습니다.`,
      focus_points: [
        "상의와 신발 중 하나를 비슷한 밝기로 맞추면 조합이 더 안정적으로 보여요.",
        "하의가 어두우면 상의는 너무 진한 색보다 밝은 중간 톤이 덜 무거워 보입니다.",
        "색을 많이 늘리기보다 검정, 흰색, 데님, 베이지 중 두세 가지 안에서 먼저 맞추세요."
      ],
      recommendation: `${payload.current_feedback.recommended_outfit.items.join(" + ")} 조합에서 상의와 신발 톤이 서로 너무 멀어지지 않게 맞춰보세요.`,
      action: "지금 가진 신발 중 상의와 가장 비슷한 밝기의 한 켤레를 골라 사진으로 비교해보세요."
    };
  }

  if (payload.module === "occasion") {
    return {
      title: "상황별 코디 체크",
      diagnosis: `${payload.survey.motivation} 상황에서는 새 옷보다 지금 조합을 얼마나 단정하게 보이게 정리하는지가 먼저입니다.`,
      focus_points: [
        "소개팅이나 첫 만남이면 너무 편한 인상보다 상의와 신발의 단정함을 먼저 보세요.",
        "출근이나 발표처럼 신뢰가 중요한 상황이면 색 수를 줄이고 주름을 정리하는 편이 안전합니다.",
        "주말 약속이면 편안함은 유지하되 신발과 겉옷 하나로 외출감을 더하면 됩니다."
      ],
      recommendation: `${payload.current_feedback.recommended_outfit.items.join(" + ")} 조합은 ${payload.survey.motivation} 기준으로 과하지 않게 정리하기 좋은 출발점입니다.`,
      action: "오늘 갈 장소를 하나 정하고, 그 장소에서 너무 집안복처럼 보이는 요소가 있는지만 먼저 빼보세요."
    };
  }

  if (payload.module === "closet") {
    const tops = payload.closet_profile?.tops || "가장 깔끔한 상의";
    const bottoms = payload.closet_profile?.bottoms || "주름이 적은 바지";
    const shoes = payload.closet_profile?.shoes || "가장 단정한 신발";
    const outerwear = payload.closet_profile?.outerwear || "가벼운 겉옷";

    return {
      title: "내 옷장 다른 조합",
      diagnosis:
        "지금 추천 조합이 기준점이라면, 옷장 안에서 바꿔볼 수 있는 후보는 상의나 겉옷 하나를 바꾸는 쪽이 가장 안전합니다.",
      focus_points: [
        `${tops}는 그대로 두고 ${bottoms}의 주름과 기장만 정리하면 기본 조합으로 쓸 수 있어요.`,
        `${outerwear}가 있다면 상의 위에 하나만 더해도 집안복 느낌이 줄어듭니다.`,
        `${shoes}는 전체 톤을 묶는 역할이므로 가장 덜 낡아 보이는 것을 먼저 고르세요.`
      ],
      recommendation: `${tops} + ${bottoms} + ${shoes} 조합을 기본으로 두고, 필요할 때 ${outerwear}만 더해보세요.`,
      action: "옷장에서 상의 2개와 바지 1개만 꺼내 같은 신발로 번갈아 입어보고 사진을 비교해보세요."
    };
  }

  return {
    title: "핏 체크",
    diagnosis: `${payload.survey.current_style} 기준으로 보면 지금은 편안함은 있지만 상의 길이와 하의 라인이 전체 비율을 조금 눌러 보이게 만들 수 있습니다.`,
    focus_points: [
      "상의 끝이 골반을 너무 많이 덮으면 다리가 짧아 보여요.",
      "하의는 주름이 적고 곧게 떨어지는 쪽이 가장 먼저 정돈돼 보입니다.",
      "신발과 바지 밑단 사이가 너무 뭉치지 않게 정리하면 전체 실루엣이 가벼워집니다."
    ],
    recommendation: `${payload.current_feedback.recommended_outfit.items.join(" + ")} 조합에서 상의 길이와 바지 밑단만 먼저 확인하세요.`,
    action: "거울 앞에서 상의를 한 번 넣어 입은 버전과 빼서 입은 버전을 나란히 비교해보세요."
  };
}
