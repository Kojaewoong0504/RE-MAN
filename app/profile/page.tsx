"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { destroyServerSession, fetchAuthSession } from "@/lib/auth/client";
import {
  readCurrentUserProfile,
  readStyleProgramStateFromFirestore
} from "@/lib/firebase/firestore";
import { signOutFirebaseSession } from "@/lib/firebase/session";
import {
  getRecentHistoryPreview,
  getStyleProgramSnapshot,
  mergePersistedProgramState,
  patchOnboardingState,
  readOnboardingState,
  writeOnboardingState,
  type OnboardingState,
  type StyleProgramSnapshot
} from "@/lib/onboarding/storage";
import type { AuthUser } from "@/lib/auth/types";
import type { UserProfileDocument } from "@/lib/firebase/firestore";

const emptyProgramSnapshot: StyleProgramSnapshot = {
  status: "new",
  entryPath: "/programs/style/onboarding/survey",
  primaryLabel: "스타일 체크 시작",
  secondaryLabel: null,
  summaryLabel: "Status",
  summaryBody: "아직 저장된 스타일 체크 결과가 없습니다."
};

function getClosetSummary(state: OnboardingState) {
  const closet = state.closet_profile;

  if (!closet) {
    return null;
  }

  const items = [
    closet.tops ? `상의 ${closet.tops}` : null,
    closet.bottoms ? `하의 ${closet.bottoms}` : null,
    closet.shoes ? `신발 ${closet.shoes}` : null,
    closet.outerwear ? `겉옷 ${closet.outerwear}` : null
  ].filter(Boolean);

  return items.length > 0 ? items.join(" · ") : null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfileDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [programSnapshot, setProgramSnapshot] =
    useState<StyleProgramSnapshot>(emptyProgramSnapshot);
  const [recentHistory, setRecentHistory] = useState<string[]>([]);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [closetSummary, setClosetSummary] = useState<string | null>(null);

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

      const localState = readOnboardingState();
      setProgramSnapshot(getStyleProgramSnapshot(localState));
      setRecentHistory(getRecentHistoryPreview(localState));
      setResultTitle(localState.feedback?.recommended_outfit.title ?? null);
      setClosetSummary(getClosetSummary(localState));

      try {
        const [nextProfile, persistedProgramState] = await Promise.all([
          readCurrentUserProfile(sessionUser.uid),
          readStyleProgramStateFromFirestore(sessionUser.uid)
        ]);

        if (active) {
          setProfile(nextProfile);

          const nextProgramState = persistedProgramState
            ? mergePersistedProgramState(localState, persistedProgramState)
            : localState;

          writeOnboardingState(nextProgramState);
          setProgramSnapshot(getStyleProgramSnapshot(nextProgramState));
          setRecentHistory(getRecentHistoryPreview(nextProgramState));
          setResultTitle(nextProgramState.feedback?.recommended_outfit.title ?? null);
          setClosetSummary(getClosetSummary(nextProgramState));
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
        <div className="app-header">
          <div className="flex items-center gap-4">
            <Link className="app-back-button" href="/">
              ←
            </Link>
            <p className="app-brand">RE:MAN</p>
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
        <section className="ui-panel p-0">
          <div className="flex items-start justify-between border-b border-black/15 p-5">
            <div className="space-y-2">
              <p className="poster-kicker">Signed In</p>
              <p className="text-3xl font-black leading-none tracking-[-0.04em] text-ink">
                {isLoading ? "불러오는 중" : displayName}
              </p>
              <p className="text-sm font-semibold leading-6 text-muted">
                {user?.email ?? "이메일 정보 없음"}
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-black bg-[var(--color-accent)] text-xl font-black text-[var(--color-accent-ink)]">
              {(displayName[0] ?? "R").toUpperCase()}
            </div>
          </div>
          <div className="grid grid-cols-2 border-b border-black/15">
            <div className="border-r border-black/15 p-4">
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
        <section className="ui-panel-accent space-y-4">
          <p className="poster-kicker text-[var(--color-accent-ink)]/70">Profile Note</p>
          <p className="text-lg font-black leading-7 tracking-tight">
            {profile?.bio?.trim() || "아직 프로필 소개가 없습니다. 설정에서 간단히 추가할 수 있습니다."}
          </p>
        </section>
        {loadError ? (
          <section className="ui-panel">
            <p className="text-sm font-bold leading-6 text-red-700">{loadError}</p>
          </section>
        ) : null}
        <section className="ui-panel-muted space-y-5">
          <div className="space-y-2">
            <p className="poster-kicker">Style Check</p>
            <h2 className="text-[30px] font-black leading-tight tracking-[-0.05em] text-ink">
              {resultTitle ?? "최근 체크 결과가 아직 없습니다"}
            </h2>
            <p className="text-sm font-bold leading-6 text-muted">
              {programSnapshot.summaryBody}
            </p>
          </div>
          {closetSummary ? (
            <p className="border-t border-black/10 pt-4 text-sm font-black leading-6 text-ink">
              {closetSummary}
            </p>
          ) : null}
          {recentHistory.length > 0 ? (
            <div className="space-y-2 border-t border-black/10 pt-4">
              <p className="poster-kicker">Recent Notes</p>
              <div className="grid gap-2">
                {recentHistory.map((history) => (
                  <p key={history} className="text-sm font-semibold leading-6 text-ink">
                    {history}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Link className="ui-button justify-between py-4" href={programSnapshot.entryPath}>
              <span>{programSnapshot.primaryLabel}</span>
              <span>→</span>
            </Link>
            <Link className="ui-button-secondary justify-between py-4" href="/programs/style">
              <span>스타일 프로그램</span>
              <span>→</span>
            </Link>
          </div>
        </section>
      </div>
      <div className="space-y-3 pb-10">
        <Link
          className="ui-button-secondary h-14 w-full text-base"
          href="/settings"
        >
          설정으로 이동
        </Link>
        <button
          className="ui-button-secondary h-12 w-full"
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
