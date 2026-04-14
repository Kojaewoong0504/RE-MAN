"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";
import { BottomCTA } from "@/components/common/BottomCTA";
import {
  getStyleProgramEntryPath,
  getStyleProgramStatus,
  readOnboardingState,
  type StyleProgramStatus
} from "@/lib/onboarding/storage";

const styleProgramImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBXjlr_phAUclWIJo-qkMkFcmG3zCIdjIpsiMEM_ErBTrpJOH-9U0xs06cqtEyPgfvTPl9g46VApTGSEmu3l3G_vFT6CiJ4U84tj7KRzXqZZzjGMIrGd989FODL3dN9SCwyu_kUsMYyw6VYnwyrAHNdloZSBQrmrBGuIFcKODC-l8IyenNIcrqa27f_SG8fl9wwNgwP4kPz84bUSkUQIglmp3-B61ohSe7wVMf4g3LlkLBZ5CPzO7llJ1VCVxbnCZhQvU9_U5Ry8gfj";

export default function StyleProgramPage() {
  const [status, setStatus] = useState<StyleProgramStatus>("new");
  const [entryPath, setEntryPath] = useState("/programs/style/onboarding/survey");

  useEffect(() => {
    const state = readOnboardingState();
    setStatus(getStyleProgramStatus(state));
    setEntryPath(getStyleProgramEntryPath(state));
  }, []);

  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="space-y-6 pt-6">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <Link className="app-back-button" href="/programs">
              ←
            </Link>
            <p className="app-brand">RE:MAN</p>
          </div>
          <AccountAccessButton />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Style Program</p>
        <h1 className="max-w-sm text-[40px] font-black leading-[1.03] tracking-[-0.05em] text-ink">
          지금 가진 옷에서 시작하는 스타일 체크
        </h1>
        <p className="max-w-md text-[17px] font-medium leading-7 text-muted">
          하루 안에 현재 인상, 추천 조합, 레퍼런스/실착 가능성을 확인합니다. 루틴은
          원할 때만 선택합니다.
        </p>
        <div className="overflow-hidden border border-black/15 bg-[var(--color-surface-raised)]">
          <Image
            alt="스타일 프로그램 소개 이미지"
            className="aspect-[4/3] w-full object-cover grayscale"
            height={720}
            src={styleProgramImage}
            width={960}
          />
        </div>
        <div className="grid gap-3">
          <div className="ui-panel">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Session</p>
            <p className="mt-2 text-lg font-black leading-6 text-ink">
              사진과 옷장 스냅샷으로 바로 결과를 봅니다
            </p>
          </div>
          <div className="ui-panel-accent">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--color-accent-ink)]/70">
              Promise
            </p>
            <p className="mt-2 text-lg font-black leading-6">
              구매를 먼저 밀지 않고, 지금 가진 조합 안에서 가능한 변화를 먼저 봅니다.
            </p>
          </div>
          <div className="ui-panel">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Return</p>
            <p className="mt-2 text-lg font-black leading-6 text-ink">
              다시 들어오면 최근 스타일 체크 결과로 바로 이어집니다.
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-3 pb-24">
        <Link
          className="block text-center text-sm text-stone-700 underline underline-offset-4"
          href="/programs"
        >
          다른 프로그램 보기
        </Link>
        <BottomCTA
          href={entryPath}
          label={
            status === "new"
              ? "스타일 프로그램 시작하기"
              : status === "active"
              ? "최근 스타일 체크 보기"
                : "최근 스타일 체크 보기"
          }
        />
      </div>
    </main>
  );
}
