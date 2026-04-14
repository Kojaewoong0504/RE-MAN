import type {
  AgentRequest,
  DailyAgentResponse,
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

export function buildMockOnboardingFeedback(
  payload: AgentRequest
): OnboardingAgentResponse {
  const style = payload.survey.current_style;
  const goal = payload.survey.style_goal || "전체적인 스타일 개선";
  const confidence = payload.survey.confidence_level || "미입력";

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
        `${goal}에는 새로 사기보다 지금 가진 옷 중 실루엣이 가장 단정한 조합을 먼저 고르는 편이 변화가 바로 보입니다.`,
      try_on_prompt:
        "전신 정면 사진을 기준으로 무지 상의, 일자핏 바지, 톤이 맞는 신발을 자연스럽게 착용한 미리보기"
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
