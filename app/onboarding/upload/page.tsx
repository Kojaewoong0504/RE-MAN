"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomCTA } from "@/components/common/BottomCTA";
import { PhotoUploader } from "@/components/upload/PhotoUploader";
import { patchOnboardingState, readOnboardingState } from "@/lib/onboarding/storage";

export default function UploadPage() {
  const router = useRouter();
  const [image, setImage] = useState<string | undefined>();
  const [textDescription, setTextDescription] = useState<string | undefined>();

  useEffect(() => {
    const state = readOnboardingState();

    if (!state.survey.current_style || !state.survey.motivation || !state.survey.budget) {
      router.replace("/programs/style/onboarding/survey");
      return;
    }

    setImage(state.image);
    setTextDescription(state.text_description);
  }, [router]);

  const hasInput = Boolean(image || textDescription?.trim());

  return (
    <main className="app-shell space-y-8">
      <div className="space-y-6 pt-6">
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <button className="text-lg" onClick={() => router.push("/programs/style/onboarding/survey")} type="button">
              ←
            </button>
            <p className="text-sm font-black tracking-tight text-ink">RE:MAN</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black bg-[#f1eadb] text-sm font-bold">
            R
          </div>
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
            현재 스타일 사진을 업로드해 주세요
          </h1>
          <p className="max-w-sm text-[16px] font-medium leading-7 text-muted">
            판단하지 않습니다. 여정의 시작점을 확인하기 위한 과정일 뿐입니다.
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
      <div className="space-y-6 pb-24">
        <div className="space-y-3">
          <p className="text-xl font-black tracking-tight text-ink">오늘의 목표는 무엇인가요?</p>
          <div className="grid gap-3">
            {["전체적인 스타일 리셋", "비즈니스 캐주얼 업그레이드", "주말 룩 체크"].map(
              (goal) => (
                <div
                  key={goal}
                  className="flex items-center justify-between border-2 border-black bg-[#fcf8ef] px-4 py-4 text-base font-bold text-ink"
                >
                  <span>{goal}</span>
                  <span>→</span>
                </div>
              )
            )}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-xl font-black tracking-tight text-ink">
            지금 얼마나 자신감이 있나요?
          </p>
          <div className="grid grid-cols-4 gap-2">
            {["막막함", "괜찮음", "배우는 중", "준비됨"].map((item) => (
              <div
                key={item}
                className={`border-2 border-black px-2 py-3 text-center text-sm font-bold ${
                  item === "배우는 중" ? "bg-black text-[#fcf8ef]" : "bg-[#fcf8ef] text-ink"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomCTA
        disabled={!hasInput}
        label="AI 분석 시작하기"
        onClick={() => {
          patchOnboardingState({
            image,
            text_description: textDescription?.trim() ? textDescription.trim() : undefined,
            feedback: undefined,
            fallback_message: undefined
          });
          router.push("/programs/style/onboarding/analyzing");
        }}
      />
    </main>
  );
}
