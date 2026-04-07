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
      router.replace("/onboarding/survey");
      return;
    }

    setImage(state.image);
    setTextDescription(state.text_description);
  }, [router]);

  const hasInput = Boolean(image || textDescription?.trim());

  return (
    <main className="app-shell space-y-8">
      <div className="space-y-4 pt-10">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">Photo Upload</p>
        <h1 className="text-4xl font-bold tracking-[-0.04em]">
          지금 입고 있는 옷 그대로 찍어주세요
        </h1>
        <p className="max-w-sm text-base leading-7 text-zinc-300">
          잘 나올 필요 없습니다. 얼굴 포함 전신, 정면, 자연광이면 충분합니다.
        </p>
      </div>
      <PhotoUploader
        image={image}
        onChange={({ image: nextImage, text_description }) => {
          setImage(nextImage);
          setTextDescription(text_description);
        }}
        textDescription={textDescription}
      />
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
          router.push("/onboarding/analyzing");
        }}
      />
    </main>
  );
}
