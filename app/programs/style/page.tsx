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
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <Link className="text-lg" href="/programs">
              ←
            </Link>
            <p className="text-sm font-black tracking-tight text-ink">RE:MAN</p>
          </div>
          <AccountAccessButton />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Style Program</p>
        <h1 className="max-w-sm text-[40px] font-black leading-[1.03] tracking-[-0.05em] text-ink">
          지금 가진 옷에서 시작하는 7일 스타일 코칭
        </h1>
        <p className="max-w-md text-[17px] font-medium leading-7 text-muted">
          첫날엔 현재 인상을 읽고, 그 뒤에는 하루에 한 가지만 더 또렷하게 만들도록
          안내합니다.
        </p>
        <div className="overflow-hidden border-2 border-black bg-[#fcf8ef]">
          <Image
            alt="스타일 프로그램 소개 이미지"
            className="aspect-[4/3] w-full object-cover grayscale"
            height={720}
            src={styleProgramImage}
            width={960}
          />
        </div>
        <div className="grid gap-3">
          <div className="border-2 border-black bg-[#fcf8ef] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Day 1</p>
            <p className="mt-2 text-lg font-black leading-6 text-ink">
              지금 가진 옷부터 다시 봅니다
            </p>
          </div>
          <div className="border-2 border-black bg-accent p-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-black/70">
              Promise
            </p>
            <p className="mt-2 text-lg font-black leading-6 text-black">
              Day 6 전까지는 구매를 밀지 않고, 지금 가진 조합 안에서만 바꿉니다.
            </p>
          </div>
          <div className="border-2 border-black bg-[#fcf8ef] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Return</p>
            <p className="mt-2 text-lg font-black leading-6 text-ink">
              다시 들어오면 지금 진행 중인 day로 바로 이어집니다.
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
              ? "스타일 이어서 하기"
                : "스타일 완료 내용 보기"
          }
        />
      </div>
    </main>
  );
}
