"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createServerSession, fetchAuthSession } from "@/lib/auth/client";
import { syncAuthenticatedProfileToFirestore } from "@/lib/firebase/firestore";
import { signInWithGoogleSession } from "@/lib/firebase/session";
import { patchOnboardingState } from "@/lib/onboarding/storage";

type LoginPageClientProps = {
  returnTo: string;
};

export function LoginPageClient({ returnTo }: LoginPageClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const session = await fetchAuthSession();

      if (session && active) {
        router.replace(returnTo);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [returnTo, router]);

  async function handleGoogleLogin() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signInWithGoogleSession();
      await createServerSession(result.idToken);
      await syncAuthenticatedProfileToFirestore({
        uid: result.uid,
        email: result.email,
        displayName: result.displayName,
        photoURL: result.photoURL
      });
      patchOnboardingState({
        user_id: result.uid,
        email: result.email ?? undefined
      });
      router.replace(returnTo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "login_failed";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="space-y-8 pt-6">
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <Link className="text-lg" href="/">
              ←
            </Link>
            <p className="text-sm font-black tracking-tight text-ink">RE:MAN</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black bg-[#f1eadb] text-sm font-bold">
            R
          </div>
        </div>
        <div className="space-y-4">
          <p className="poster-kicker">Account Access</p>
          <h1 className="max-w-sm text-[40px] font-black leading-[1.03] tracking-[-0.05em] text-ink">
            진행한 변화와 계정을 함께 관리합니다
          </h1>
          <p className="max-w-sm text-[17px] font-medium leading-7 text-muted">
            Google 로그인으로 프로필, 설정, 이후 저장 기능을 관리합니다. 스타일
            프로그램 자체는 계속 지금처럼 가볍게 시작할 수 있습니다.
          </p>
        </div>
        <section className="space-y-4 border-2 border-black bg-[#fcf8ef] p-5">
          <p className="poster-kicker">Google Login</p>
          <button
            className="flex h-14 w-full items-center justify-center border-2 border-black bg-accent text-base font-black text-black disabled:opacity-40"
            disabled={isLoading}
            onClick={() => void handleGoogleLogin()}
            type="button"
          >
            {isLoading ? "로그인 연결 중..." : "Google로 계속하기"}
          </button>
          <p className="text-sm leading-6 text-muted">
            로그인 후 프로필 수정, 설정 변경, 계정 로그아웃 기능을 사용할 수 있습니다.
          </p>
          {errorMessage ? <p className="text-sm font-semibold text-red-700">{errorMessage}</p> : null}
        </section>
      </div>
      <div className="pb-10">
        <Link className="text-sm text-stone-700 underline underline-offset-4" href="/">
          홈으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
