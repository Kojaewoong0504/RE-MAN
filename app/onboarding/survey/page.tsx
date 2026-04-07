import { BottomCTA } from "@/components/common/BottomCTA";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SurveyStep } from "@/components/survey/SurveyStep";

export default function SurveyPage() {
  return (
    <main className="app-shell space-y-8">
      <ProgressBar current={1} total={3} />
      <SurveyStep
        title="지금 스타일이 어때요?"
        caption="질문은 세 개만 묻습니다. 먼저 지금 자주 입는 조합을 골라주세요."
        options={[
          { label: "운동복/후드티 위주" },
          { label: "청바지 + 무지 티셔츠" },
          { label: "회사 유니폼/캐주얼 혼합" },
          { label: "잘 모르겠어요" }
        ]}
      />
      <SurveyStep
        title="스타일을 바꾸고 싶은 계기가 있나요?"
        caption="지금 변화가 필요한 이유를 알면 피드백의 방향이 더 선명해집니다."
        options={[
          { label: "소개팅 / 이성 만남" },
          { label: "직장 이미지 변화" },
          { label: "그냥 나 자신을 위해" },
          { label: "딱히 없어요, 그냥 궁금해서" }
        ]}
      />
      <SurveyStep
        title="한 달 스타일링 예산은?"
        caption="Day 6 전까지는 구매를 강요하지 않습니다. 예산 감각만 맞춰 둡니다."
        options={[
          { label: "5만원 이하" },
          { label: "5~15만원" },
          { label: "15~30만원" },
          { label: "30만원 이상" }
        ]}
      />
      <BottomCTA href="/onboarding/upload" label="사진 업로드로 이동" />
    </main>
  );
}
