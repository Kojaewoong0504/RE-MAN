"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";
import { BottomCTA } from "@/components/common/BottomCTA";
import {
  getStyleProgramStatus,
  readOnboardingState,
  type StyleProgramStatus
} from "@/lib/onboarding/storage";

const styleProgramImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBXjlr_phAUclWIJo-qkMkFcmG3zCIdjIpsiMEM_ErBTrpJOH-9U0xs06cqtEyPgfvTPl9g46VApTGSEmu3l3G_vFT6CiJ4U84tj7KRzXqZZzjGMIrGd989FODL3dN9SCwyu_kUsMYyw6VYnwyrAHNdloZSBQrmrBGuIFcKODC-l8IyenNIcrqa27f_SG8fl9wwNgwP4kPz84bUSkUQIglmp3-B61ohSe7wVMf4g3LlkLBZ5CPzO7llJ1VCVxbnCZhQvU9_U5Ry8gfj";

export default function StyleProgramPage() {
  const [status, setStatus] = useState<StyleProgramStatus>("new");

  useEffect(() => {
    const state = readOnboardingState();
    setStatus(getStyleProgramStatus(state));
  }, []);

  const startPath =
    status === "new"
      ? "/programs/style/onboarding/survey"
      : "/programs/style/onboarding/upload?reset=photo";
  const startLabel = status === "new" ? "시작" : "새 체크";
  const bottomLabel =
    status === "new" ? "스타일 프로그램 시작하기" : "새 스타일 체크 시작하기";

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
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 space-y-4 p-5 text-[var(--color-bg)]">
            <div>
              <p className="poster-kicker text-[var(--color-bg)]/60">Style Check</p>
              <h1 className="mt-3 text-[42px] font-black leading-[0.95] tracking-[-0.07em]">
                사진 올리고 조합 받기
              </h1>
            </div>
            <Link className="hero-inline-cta" href={startPath}>
              <span>{startLabel}</span>
              <span>→</span>
            </Link>
          </div>
        </section>

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
      <div className="space-y-3 pb-24">
        <Link
          className="block text-center text-sm font-black text-muted underline underline-offset-4"
          href="/programs"
        >
          다른 프로그램 보기
        </Link>
        <BottomCTA
          href={startPath}
          label={bottomLabel}
        />
      </div>
    </main>
  );
}
