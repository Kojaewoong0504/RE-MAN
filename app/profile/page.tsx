"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { destroyServerSession, fetchAuthSession } from "@/lib/auth/client";
import { readCurrentUserProfile } from "@/lib/firebase/firestore";
import { signOutFirebaseSession } from "@/lib/firebase/session";
import { patchOnboardingState } from "@/lib/onboarding/storage";
import type { AuthUser } from "@/lib/auth/types";
import type { UserProfileDocument } from "@/lib/firebase/firestore";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfileDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      const sessionUser = await fetchAuthSession();

      if (!sessionUser) {
        router.replace("/login?returnTo=/profile");
        return;
      }

      if (!active) {
        return;
      }

      setUser(sessionUser);

      try {
        const nextProfile = await readCurrentUserProfile(sessionUser.uid);
        if (active) {
          setProfile(nextProfile);
        }
      } catch {
        if (active) {
          setProfile(null);
          setLoadError("프로필 세부 정보를 불러오지 못했습니다. 계정 세션은 유지됩니다.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await destroyServerSession();
      await signOutFirebaseSession();
      patchOnboardingState({ user_id: undefined, email: undefined });
      router.replace("/");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const displayName = profile?.displayName || user?.name || "RE:MAN User";
  const preferredProgram = profile?.preferredProgram ?? "style";
  const preferredProgramLabel =
    preferredProgram === "style"
      ? "스타일"
      : preferredProgram === "hair"
        ? "헤어"
        : preferredProgram === "body"
          ? "체형/자세"
          : "피부";

  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="poster-grid pt-6">
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <Link className="text-lg" href="/">
              ←
            </Link>
            <p className="text-sm font-black tracking-tight text-ink">RE:MAN</p>
          </div>
          <Link
            className="text-sm font-black uppercase tracking-[0.12em] text-ink underline underline-offset-4"
            href="/settings"
          >
            Settings
          </Link>
        </div>
        <div className="space-y-4 poster-rule">
          <p className="poster-kicker">Profile</p>
          <h1 className="text-[40px] font-black leading-[1.03] tracking-[-0.05em] text-ink">
            계정과 프로그램 상태를 한 곳에서 봅니다
          </h1>
          <p className="max-w-sm text-base font-semibold leading-7 text-muted">
            Google 계정, 선호 프로그램, 프로필 메모를 관리합니다. 진행 기록은 로그인된
            계정으로 다시 불러옵니다.
          </p>
        </div>
        <section className="border-2 border-black bg-[#fcf8ef]">
          <div className="flex items-start justify-between border-b-2 border-black p-5">
            <div className="space-y-2">
              <p className="poster-kicker">Signed In</p>
              <p className="text-3xl font-black leading-none tracking-[-0.04em] text-ink">
                {isLoading ? "불러오는 중" : displayName}
              </p>
              <p className="text-sm font-semibold leading-6 text-muted">
                {user?.email ?? "이메일 정보 없음"}
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-black bg-accent text-xl font-black text-black">
              {(displayName[0] ?? "R").toUpperCase()}
            </div>
          </div>
          <div className="grid grid-cols-2 border-b-2 border-black">
            <div className="border-r-2 border-black p-4">
              <p className="poster-kicker">Provider</p>
              <p className="mt-2 text-lg font-black text-ink">Google</p>
            </div>
            <div className="p-4">
              <p className="poster-kicker">Program</p>
              <p className="mt-2 text-lg font-black text-ink">{preferredProgramLabel}</p>
            </div>
          </div>
          <div className="p-5">
            <p className="poster-kicker">User ID</p>
            <p className="mt-2 break-all text-xs font-bold uppercase tracking-[0.12em] text-muted">
              {user?.uid ?? "-"}
            </p>
          </div>
        </section>
        <section className="space-y-4 border-2 border-black bg-accent p-5">
          <p className="poster-kicker text-black/70">Profile Note</p>
          <p className="text-lg font-black leading-7 tracking-tight text-black">
            {profile?.bio?.trim() || "아직 프로필 소개가 없습니다. 설정에서 간단히 추가할 수 있습니다."}
          </p>
        </section>
        {loadError ? (
          <section className="border-2 border-black bg-white p-4">
            <p className="text-sm font-bold leading-6 text-red-700">{loadError}</p>
          </section>
        ) : null}
      </div>
      <div className="space-y-3 pb-10">
        <Link
          className="flex h-14 w-full items-center justify-center border-2 border-black bg-[#fcf8ef] text-base font-black"
          href="/settings"
        >
          설정으로 이동
        </Link>
        <button
          className="h-12 w-full border-2 border-black bg-white text-sm font-black text-ink"
          disabled={isLoggingOut}
          onClick={() => void handleLogout()}
          type="button"
        >
          {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </div>
    </main>
  );
}
