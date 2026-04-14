"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";
import { BottomCTA } from "@/components/common/BottomCTA";
import { PhotoUploader } from "@/components/upload/PhotoUploader";
import type { ClosetProfile } from "@/lib/agents/contracts";
import { syncSurveyToFirestore } from "@/lib/firebase/firestore";
import { patchOnboardingState, readOnboardingState } from "@/lib/onboarding/storage";

const emptyClosetProfile: ClosetProfile = {
  tops: "",
  bottoms: "",
  shoes: "",
  outerwear: "",
  avoid: ""
};

const closetFields: Array<{
  key: keyof ClosetProfile;
  label: string;
  placeholder: string;
}> = [
  {
    key: "tops",
    label: "자주 입는 상의",
    placeholder: "예: 무지 티셔츠, 후드티, 체크 셔츠"
  },
  {
    key: "bottoms",
    label: "자주 입는 하의",
    placeholder: "예: 청바지, 조거팬츠, 검정 슬랙스"
  },
  {
    key: "shoes",
    label: "자주 신는 신발",
    placeholder: "예: 뉴발란스 운동화, 검정 스니커즈"
  },
  {
    key: "outerwear",
    label: "겉옷/레이어",
    placeholder: "예: 바람막이, 가디건, 자켓 없음"
  },
  {
    key: "avoid",
    label: "피하고 싶은 것",
    placeholder: "예: 너무 튀는 색, 꽉 끼는 옷"
  }
];

const styleGoals = ["전체적인 스타일 리셋", "비즈니스 캐주얼 업그레이드", "주말 룩 체크"];
const confidenceLevels = ["막막함", "괜찮음", "배우는 중", "준비됨"];

export default function UploadPage() {
  const router = useRouter();
  const [image, setImage] = useState<string | undefined>();
  const [textDescription, setTextDescription] = useState<string | undefined>();
  const [closetProfile, setClosetProfile] = useState<ClosetProfile>(emptyClosetProfile);
  const [styleGoal, setStyleGoal] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState("");

  useEffect(() => {
    const state = readOnboardingState();

    if (!state.survey.current_style || !state.survey.motivation || !state.survey.budget) {
      router.replace("/programs/style/onboarding/survey");
      return;
    }

    setImage(state.image);
    setTextDescription(state.text_description);
    setClosetProfile({
      ...emptyClosetProfile,
      ...state.closet_profile
    });
    setStyleGoal(state.survey.style_goal ?? "");
    setConfidenceLevel(state.survey.confidence_level ?? "");
  }, [router]);

  const hasPhotoInput = Boolean(image || textDescription?.trim());
  const hasClosetInput = Object.values(closetProfile).some((value) => value?.trim());
  const hasInput = hasPhotoInput && hasClosetInput && Boolean(styleGoal && confidenceLevel);

  return (
    <main className="app-shell space-y-7">
      <div className="space-y-5 pt-4">
        <div className="flex items-center justify-between border-b border-black/15 pb-4">
          <div className="flex items-center gap-4">
            <button
              className="text-lg"
              onClick={() => router.push("/programs/style/onboarding/survey")}
              type="button"
            >
              ←
            </button>
            <p className="text-sm font-black tracking-tight text-ink">RE:MAN</p>
          </div>
          <AccountAccessButton />
        </div>
        <div className="space-y-2">
          <div className="h-1 w-full bg-black/10">
            <div className="h-full w-2/3 bg-black" />
          </div>
          <p className="text-[13px] font-bold uppercase tracking-[0.24em] text-muted">
            Step 02 / 03
          </p>
        </div>
        <div className="space-y-4">
          <h1 className="text-[38px] font-black leading-[1.06] tracking-[-0.05em] text-ink">
            사진이 이번 체크의 기준입니다
          </h1>
          <p className="max-w-sm text-[16px] font-medium leading-7 text-muted">
            지금 입은 모습 그대로 올려주세요. 평가가 아니라, 오늘 바꿀 한 가지를 찾기
            위한 기준 사진입니다.
          </p>
        </div>
      </div>
      <PhotoUploader
        image={image}
        onChange={({ image: nextImage, text_description }) => {
          setImage(nextImage);
          setTextDescription(text_description);
        }}
        textDescription={textDescription}
      />
      <div className="space-y-7 pb-24">
        <section className="space-y-5 border-t border-black/15 pt-6">
          <div className="space-y-2">
            <p className="poster-kicker">Closet Snapshot</p>
            <h2 className="text-[28px] font-black leading-[1.05] tracking-[-0.05em] text-ink">
              추천은 옷장 안에서 시작합니다
            </h2>
            <p className="text-[15px] font-medium leading-6 text-muted">
              전부 채우지 않아도 됩니다. 자주 입는 상의, 하의, 신발 중 하나만 있어도
              지금 가진 것 안에서 조합을 만들 수 있습니다.
            </p>
          </div>
          <div className="grid gap-3">
            {closetFields.map((field) => (
              <label key={field.key} className="grid gap-2">
                <span className="text-sm font-black text-ink">{field.label}</span>
                <input
                  className="min-h-12 border border-black/20 bg-white px-3 text-sm font-semibold text-ink outline-none placeholder:text-black/35 focus:border-black"
                  onChange={(event) =>
                    setClosetProfile((current) => ({
                      ...current,
                      [field.key]: event.target.value
                    }))
                  }
                  placeholder={field.placeholder}
                  value={closetProfile[field.key] ?? ""}
                />
              </label>
            ))}
          </div>
        </section>
        <section className="space-y-4 border-t border-black/15 pt-6">
          <div className="space-y-2">
            <p className="poster-kicker">Goal</p>
            <h2 className="text-[28px] font-black leading-[1.05] tracking-[-0.05em] text-ink">
              오늘 체크의 목표를 고르세요
            </h2>
          </div>
          <div className="grid gap-3">
            {styleGoals.map((goal) => {
              const selected = styleGoal === goal;

              return (
                <button
                  key={goal}
                  aria-pressed={selected}
                  className={`flex items-center justify-between border px-4 py-4 text-left text-base font-bold transition ${
                    selected
                      ? "border-black bg-black text-[#fcf8ef]"
                      : "border-black/15 bg-[#fcf8ef] text-ink"
                  }`}
                  onClick={() => setStyleGoal(goal)}
                  type="button"
                >
                  <span>{goal}</span>
                  <span>{selected ? "선택됨" : "→"}</span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="space-y-4 border-t border-black/15 pt-6">
          <div className="space-y-2">
            <p className="poster-kicker">Confidence</p>
            <h2 className="text-[28px] font-black leading-[1.05] tracking-[-0.05em] text-ink">
              지금의 감각도 같이 봅니다
            </h2>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {confidenceLevels.map((item) => (
              <button
                key={item}
                aria-pressed={confidenceLevel === item}
                className={`border px-2 py-3 text-center text-sm font-bold transition ${
                  confidenceLevel === item
                    ? "border-black bg-black text-[#fcf8ef]"
                    : "border-black/15 bg-[#fcf8ef] text-ink"
                }`}
                onClick={() => setConfidenceLevel(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      </div>
      <BottomCTA
        disabled={!hasInput}
        label="AI 분석 시작하기"
        onClick={() => {
          const currentState = readOnboardingState();
          const nextState = patchOnboardingState({
            survey: {
              ...currentState.survey,
              style_goal: styleGoal,
              confidence_level: confidenceLevel
            },
            closet_profile: closetProfile,
            image,
            text_description: textDescription?.trim() ? textDescription.trim() : undefined,
            feedback: undefined,
            fallback_message: undefined
          });
          void syncSurveyToFirestore(nextState);
          router.push("/programs/style/onboarding/analyzing");
        }}
      />
    </main>
  );
}
