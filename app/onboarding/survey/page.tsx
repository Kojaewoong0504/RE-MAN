"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomCTA } from "@/components/common/BottomCTA";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SurveyCard } from "@/components/survey/SurveyCard";
import { syncSurveyToFirestore } from "@/lib/firebase/firestore";
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
      <div className="space-y-6 pt-6">
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <button className="text-lg" onClick={() => router.push("/programs/style")} type="button">
              ←
            </button>
            <p className="text-sm font-black tracking-tight text-ink">RE:MAN</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black bg-[#f1eadb] text-sm font-bold">
            R
          </div>
        </div>
        <div className="space-y-3">
          <ProgressBar current={1} total={3} />
          <p className="poster-kicker">Style Program / Step 01</p>
        </div>
        <div className="space-y-4">
          <h1 className="max-w-sm text-[42px] font-black leading-[1.02] tracking-[-0.06em] text-ink">
            처음엔 복잡하게 묻지 않습니다
          </h1>
          <p className="max-w-sm text-[17px] font-medium leading-7 text-muted">
            지금 어떤 조합에 익숙한지, 왜 바꾸고 싶은지, 예산 감각만 정리하면 첫 진단을
            시작할 수 있습니다.
          </p>
        </div>
      </div>
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
      <section className="poster-rule space-y-3 pb-24">
        <p className="poster-kicker">Why it works</p>
        <p className="max-w-md text-lg font-black leading-7 tracking-tight text-ink">
          여기서 정한 답변은 평가가 아니라, 지금 가진 조건 안에서 가장 현실적인 변화를
          만들기 위한 출발점입니다.
        </p>
      </section>
      <BottomCTA
        disabled={!isComplete}
        label="사진 업로드로 이동"
        onClick={() => {
          const nextState = patchOnboardingState({
            survey,
            feedback: undefined,
            fallback_message: undefined
          });
          void syncSurveyToFirestore(nextState);
          router.push("/programs/style/onboarding/upload");
          return nextState;
        }}
      />
    </main>
  );
}
