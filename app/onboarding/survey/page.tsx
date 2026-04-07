"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomCTA } from "@/components/common/BottomCTA";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SurveyCard } from "@/components/survey/SurveyCard";
import { patchOnboardingState, readOnboardingState } from "@/lib/onboarding/storage";

export default function SurveyPage() {
  const router = useRouter();
  const [survey, setSurvey] = useState({
    current_style: "",
    motivation: "",
    budget: ""
  });

  useEffect(() => {
    const state = readOnboardingState();
    setSurvey(state.survey);
  }, []);

  const isComplete = Object.values(survey).every((value) => value.trim().length > 0);

  return (
    <main className="app-shell space-y-8">
      <ProgressBar current={1} total={3} />
      <SurveyCard
        caption="질문은 세 개만 묻습니다. 먼저 지금 자주 입는 조합을 골라주세요."
        onChange={(current_style) => setSurvey((current) => ({ ...current, current_style }))}
        options={[
          "운동복/후드티 위주",
          "청바지 + 무지 티셔츠",
          "회사 유니폼/캐주얼 혼합",
          "잘 모르겠어요"
        ]}
        title="지금 스타일이 어때요?"
        value={survey.current_style}
      />
      <SurveyCard
        caption="지금 변화가 필요한 이유를 알면 피드백의 방향이 더 선명해집니다."
        onChange={(motivation) => setSurvey((current) => ({ ...current, motivation }))}
        options={[
          "소개팅 / 이성 만남",
          "직장 이미지 변화",
          "그냥 나 자신을 위해",
          "딱히 없어요, 그냥 궁금해서"
        ]}
        title="스타일을 바꾸고 싶은 계기가 있나요?"
        value={survey.motivation}
      />
      <SurveyCard
        caption="Day 6 전까지는 구매를 강요하지 않습니다. 예산 감각만 맞춰 둡니다."
        onChange={(budget) => setSurvey((current) => ({ ...current, budget }))}
        options={["5만원 이하", "5~15만원", "15~30만원", "30만원 이상"]}
        title="한 달 스타일링 예산은?"
        value={survey.budget}
      />
      <BottomCTA
        disabled={!isComplete}
        label="사진 업로드로 이동"
        onClick={() => {
          const nextState = patchOnboardingState({ survey, feedback: undefined, fallback_message: undefined });
          router.push("/onboarding/upload");
          return nextState;
        }}
      />
    </main>
  );
}
