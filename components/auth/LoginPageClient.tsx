"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createDevServerSession,
  createServerSession,
  fetchAuthSession,
  readCachedAuthSessionSnapshot
} from "@/lib/auth/client";
import { syncAuthenticatedProfileToFirestore } from "@/lib/firebase/firestore";
import {
  completeGoogleRedirectSession,
  signInWithGoogleSession,
  type AuthenticatedGoogleSession
} from "@/lib/firebase/session";
import { patchOnboardingState } from "@/lib/onboarding/storage";

type LoginPageClientProps = {
  returnTo: string;
};

const LOGIN_STEP_TIMEOUT_MS = 12_000;
const isLocalDevLoginVisible = process.env.NODE_ENV !== "production";

async function withLoginTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label}_timeout`));
    }, LOGIN_STEP_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function LoginPageClient({ returnTo }: LoginPageClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function establishSession(result: AuthenticatedGoogleSession) {
    await withLoginTimeout(createServerSession(result.idToken), "server_session");
    patchOnboardingState({
      user_id: result.uid,
      email: result.email ?? undefined
    });

    void withLoginTimeout(
      syncAuthenticatedProfileToFirestore({
        uid: result.uid,
        email: result.email,
        displayName: result.displayName,
        photoURL: result.photoURL
      }),
      "profile_sync"
    ).catch((error) => {
      console.warn("[login_profile_sync_failed]", error);
    });
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const redirectResult = await withLoginTimeout(
          completeGoogleRedirectSession(),
          "google_redirect_result"
        );

        if (redirectResult) {
          await establishSession(redirectResult);

          if (active) {
            router.replace(returnTo);
          }
          return;
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : "login_failed";
          setErrorMessage(message);
        }
      }

      const cachedSession = readCachedAuthSessionSnapshot();
      const session =
        cachedSession === undefined
          ? await fetchAuthSession({ includeCredits: true })
          : cachedSession;

      if (session && active) {
        router.replace(returnTo);
      }

      if (active) {
        setIsLoading(false);
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

      if (result.status === "redirecting") {
        return;
      }

      await establishSession(result);
      router.replace(returnTo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "login_failed";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDevLogin() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const user = await createDevServerSession();
      patchOnboardingState({
        user_id: user?.uid,
        email: user?.email ?? undefined
      });
      router.replace(returnTo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "dev_login_failed";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="space-y-8 pt-6">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <Link className="app-back-button" href="/">
              ←
            </Link>
            <p className="app-brand">RE:MAN</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/15 bg-[#fffaf0] text-sm font-bold">
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
        <section className="ui-panel space-y-4">
          <p className="poster-kicker">Google Login</p>
          <button
            className="ui-button-accent h-14 w-full text-base"
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
          {isLocalDevLoginVisible ? (
            <div className="rounded-xl bg-[var(--color-surface)] p-3">
              <p className="text-xs font-bold leading-5 text-muted">
                Codex/IAB 검증용 로컬 로그인입니다. 배포 환경에는 노출되지 않습니다.
              </p>
              <button
                className="ui-button-secondary mt-3 h-12 w-full"
                disabled={isLoading}
                onClick={() => void handleDevLogin()}
                type="button"
              >
                개발용으로 계속하기
              </button>
            </div>
          ) : null}
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
