"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BottomCTA } from "@/components/common/BottomCTA";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";
import {
  getStyleProgramSnapshot,
  readOnboardingState,
  type StyleProgramSnapshot
} from "@/lib/onboarding/storage";

const landingHeroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAapHX97qtDFt-KUOu4pgfWrOt-skAndFIM5NXu2yZgsBHO5Q1_49WKz0B2vPaZWBEcUDvFYX1af513roA3ct3qaA7dmKKYn78VJXwSaye9YnJza5d5t17nVfthn61t6iYUxqRbgSnIay2xjfj6PbrOqernDHCDIkHoC5NnK01kYSyxG56NMouPrxJ0jqIEG6onY1XrO7o4fGXBrBNWgtX7NPjSi0Muo3f3Yw1bNzmxyC1oF3NfANDXhMn2J2ptBpRRioiz5SPoRtd7";

export default function LandingPage() {
  const [snapshot, setSnapshot] = useState<StyleProgramSnapshot>({
    status: "new",
    entryPath: "/programs/style/onboarding/survey",
    primaryLabel: "프로그램 보기",
    secondaryLabel: null,
    summaryLabel: "Status",
    summaryBody: "아직 시작한 프로그램이 없습니다. 먼저 바꾸고 싶은 영역을 고르세요."
  });

  useEffect(() => {
    const state = readOnboardingState();
    setSnapshot(getStyleProgramSnapshot(state));
  }, []);

  const heading =
    snapshot.status === "new"
      ? "판단 없이, 변화를 시작하게 만드는 코치"
      : snapshot.status === "active"
        ? "지금 하던 변화를 바로 이어가면 됩니다"
        : "한 프로그램을 끝냈다면, 다음 선택만 남았습니다";

  const body =
    snapshot.status === "new"
      ? "스타일에서 시작하고, 나중에는 헤어와 체형, 피부까지 확장합니다. 지금은 스타일 프로그램이 먼저 열려 있습니다."
      : snapshot.status === "active"
        ? "이미 시작한 사용자는 같은 onboarding을 반복하지 않습니다. 지금 진행 중인 스타일 프로그램으로 바로 복귀할 수 있습니다."
        : "스타일 7일을 끝낸 사용자는 완료 내용을 다시 보거나, 다음 변화 영역을 고를 수 있습니다.";

  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="poster-grid pt-6">
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <p className="text-sm font-black tracking-tight text-ink">RE:MAN</p>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black bg-[#f1eadb] text-sm font-bold">
            R
          </div>
        </div>
        <div className="space-y-5 pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted">
            Judgment-Free Change
          </p>
          <h1 className="max-w-sm text-[42px] font-black leading-[1.02] tracking-[-0.05em] text-ink">
            {heading}
          </h1>
          <p className="max-w-sm text-[18px] font-semibold leading-7 text-muted">
            {body}
          </p>
        </div>
        <div className="overflow-hidden border-2 border-black bg-surface">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="bg-black px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[#fcf8ef]">
              Mission 01
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-muted">
              Style First
            </span>
          </div>
          <div className="relative aspect-[4/5]">
            <Image
              alt="RE:MAN landing visual"
              className="h-full w-full object-cover grayscale"
              fill
              src={landingHeroImage}
            />
            <div className="absolute inset-x-0 bottom-0 border-t-2 border-black bg-black/85 p-4 text-[#fcf8ef]">
              <p className="text-sm font-bold leading-6">
                사진 한 장과 몇 가지 답변만으로, 지금의 인상과 다음 한 걸음을 정리합니다.
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="border-2 border-black bg-accent p-4">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-black">Start</p>
            <p className="mt-2 text-lg font-bold leading-7 text-black">
              회원가입 없이 먼저 시작하고, 진행 중인 사용자는 같은 onboarding을 반복하지 않습니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="border-2 border-black bg-[#fcf8ef] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Private</p>
              <p className="mt-3 text-lg font-black leading-6 text-ink">사람 대신 AI만 봅니다</p>
            </div>
            <div className="border-2 border-black bg-[#fcf8ef] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Fast</p>
              <p className="mt-3 text-lg font-black leading-6 text-ink">첫 진단은 3분이면 충분합니다</p>
            </div>
          </div>
        </div>
        {snapshot.summaryLabel && snapshot.summaryBody ? (
          <FeedbackCard
            label={snapshot.summaryLabel}
            body={snapshot.summaryBody}
            accent={snapshot.status !== "new"}
          />
        ) : null}
        {snapshot.status === "completed" ? (
          <FeedbackCard
            label="Next Step"
            body="스타일 완료 내용을 다시 보거나, 다른 프로그램을 고르면서 다음 변화를 시작할 수 있습니다."
          />
        ) : null}
      </div>
      <div className="space-y-3 pb-24">
        {snapshot.secondaryLabel ? (
          <Link
            className="block text-center text-sm text-stone-700 underline underline-offset-4"
            href="/programs"
          >
            {snapshot.secondaryLabel}
          </Link>
        ) : null}
        <BottomCTA
          href={snapshot.status === "new" ? "/programs" : snapshot.entryPath}
          label={snapshot.primaryLabel}
        />
      </div>
    </main>
  );
}
