"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";
import {
  buildClosetItemsFromProfile,
  getClosetCategoryLabel,
  getMinimumClosetReadiness,
  normalizeClosetItems,
  readOnboardingState,
  type OnboardingState
} from "@/lib/onboarding/storage";

const styleProgramImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBXjlr_phAUclWIJo-qkMkFcmG3zCIdjIpsiMEM_ErBTrpJOH-9U0xs06cqtEyPgfvTPl9g46VApTGSEmu3l3G_vFT6CiJ4U84tj7KRzXqZZzjGMIrGd989FODL3dN9SCwyu_kUsMYyw6VYnwyrAHNdloZSBQrmrBGuIFcKODC-l8IyenNIcrqa27f_SG8fl9wwNgwP4kPz84bUSkUQIglmp3-B61ohSe7wVMf4g3LlkLBZ5CPzO7llJ1VCVxbnCZhQvU9_U5Ry8gfj";

type StyleNextAction = {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  steps: Array<{ label: string; ready: boolean }>;
};

function hasCompletedSurvey(state: OnboardingState) {
  return Boolean(
    state.survey.current_style.trim() &&
      state.survey.motivation.trim() &&
      state.survey.budget.trim()
  );
}

function buildStyleNextAction(state: OnboardingState): StyleNextAction {
  const closetItems = normalizeClosetItems(state.closet_items);
  const usableClosetItems = closetItems.length
    ? closetItems
    : buildClosetItemsFromProfile(state.closet_profile);
  const readiness = getMinimumClosetReadiness(usableClosetItems);
  const steps = readiness.requiredCategories.map((category) => ({
    label: getClosetCategoryLabel(category),
    ready: readiness.presentCategories.includes(category)
  }));

  if (!readiness.isReady) {
    const missingLabels = readiness.missingCategories.map(getClosetCategoryLabel);

    return {
      eyebrow: "Next",
      title: "옷장부터 채우기",
      body: `${missingLabels.join(", ")} 필요`,
      href: "/closet",
      cta: "옷장 채우기",
      steps
    };
  }

  if (!hasCompletedSurvey(state)) {
    return {
      eyebrow: "Next",
      title: "기본 질문 3개",
      body: "옷장은 준비됨. 스타일 기준만 고르면 됩니다.",
      href: "/programs/style/onboarding/survey",
      cta: "질문 답하기",
      steps
    };
  }

  return {
    eyebrow: "Next",
    title: "사진만 올리기",
    body: "상의, 하의, 신발 준비됨",
    href: "/programs/style/onboarding/upload?reset=photo",
    cta: "사진 업로드",
    steps
  };
}

export default function StyleProgramPage() {
  const [nextAction, setNextAction] = useState<StyleNextAction | null>(null);

  useEffect(() => {
    const state = readOnboardingState();
    setNextAction(buildStyleNextAction(state));
  }, []);

  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="space-y-5 pt-6">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <Link className="app-back-button" href="/programs">
              ←
            </Link>
            <p className="app-brand">RE:MAN</p>
          </div>
          <AccountAccessButton />
        </div>

        <section className="style-start-hero">
          <Image
            alt="스타일 프로그램 소개 이미지"
            className="h-full w-full object-cover grayscale"
            fill
            priority
            src={styleProgramImage}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-ink)] via-[rgba(5,17,37,0.38)] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 space-y-4 p-6 text-[var(--color-bg)]">
            <div>
              <p className="poster-kicker text-[var(--color-bg)]/60">Style Check</p>
              <h1 className="mt-3 text-[42px] font-black leading-[0.95] tracking-[-0.07em]">
                사진 올리고 조합 받기
              </h1>
              <p className="mt-3 max-w-[260px] text-sm font-bold leading-6 text-white/72">
                전신 사진과 옷장 기록을 기준으로 오늘 바꿀 조합 하나를 고릅니다.
              </p>
            </div>
          </div>
        </section>

        {nextAction ? (
          <section aria-label="스타일 체크 다음 행동" className="style-next-action">
            <div>
              <p className="poster-kicker">{nextAction.eyebrow}</p>
              <h2>{nextAction.title}</h2>
              <p>{nextAction.body}</p>
            </div>
            <div className="style-next-readiness" aria-label="스타일 체크 준비 상태">
              {nextAction.steps.map((step) => (
                <span className={step.ready ? "style-next-ready" : ""} key={step.label}>
                  {step.label}
                </span>
              ))}
            </div>
            <Link className="hero-inline-cta" href={nextAction.href}>
              <span>{nextAction.cta}</span>
              <span>→</span>
            </Link>
          </section>
        ) : null}

        <section className="style-start-strip">
          <div>
            <p>01</p>
            <span>전신</span>
          </div>
          <div>
            <p>02</p>
            <span>옷장</span>
          </div>
          <div>
            <p>03</p>
            <span>추천</span>
          </div>
        </section>

      </div>
      <div className="pb-24 pt-5">
        <Link
          className="block text-center text-sm font-black text-muted underline underline-offset-4"
          href="/programs"
        >
          다른 프로그램 보기
        </Link>
      </div>
    </main>
  );
}
