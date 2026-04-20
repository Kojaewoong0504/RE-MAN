"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditLedger } from "@/components/credits/CreditLedger";
import { CreditStatus } from "@/components/credits/CreditStatus";
import { destroyServerSession, fetchAuthSession } from "@/lib/auth/client";
import { readCurrentUserProfile } from "@/lib/firebase/firestore";
import { signOutFirebaseSession } from "@/lib/firebase/session";
import {
  getStyleProgramSnapshot,
  getStyleFeedbackTimeline,
  normalizeClosetItems,
  patchOnboardingState,
  readOnboardingState,
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
  summaryBody: "첫 체크 대기"
};

const programLabels: Record<string, string> = {
  style: "스타일",
  hair: "헤어",
  body: "체형",
  skin: "피부"
};

type ProfileDataSummary = {
  closetCount: number;
  historyCount: number;
  hasRecommendationFeedback: boolean;
};

const emptyDataSummary: ProfileDataSummary = {
  closetCount: 0,
  historyCount: 0,
  hasRecommendationFeedback: false
};

function getProfileDataSummary(): ProfileDataSummary {
  const state = readOnboardingState();

  return {
    closetCount: normalizeClosetItems(state.closet_items).length,
    historyCount: getStyleFeedbackTimeline(state).length,
    hasRecommendationFeedback: Boolean(state.recommendation_feedback)
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfileDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [programSnapshot, setProgramSnapshot] =
    useState<StyleProgramSnapshot>(emptyProgramSnapshot);
  const [dataSummary, setDataSummary] = useState<ProfileDataSummary>(emptyDataSummary);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);

      const sessionUser = await fetchAuthSession();

      if (!sessionUser) {
        router.replace("/login?returnTo=/profile");
        return;
      }

      if (!active) {
        return;
      }

      setUser(sessionUser);
      setProgramSnapshot(getStyleProgramSnapshot(readOnboardingState()));
      setDataSummary(getProfileDataSummary());

      try {
        const nextProfile = await readCurrentUserProfile(sessionUser.uid);

        if (active) {
          setProfile(nextProfile);
        }
      } catch {
        // Profile sync is optional for the account screen; the session user and
        // local program state still provide a usable app shell.
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
  const preferredProgramLabel = programLabels[preferredProgram] ?? "스타일";
  const statusLabel = programSnapshot.status === "new" ? "대기" : "저장됨";

  return (
    <main className="app-shell min-h-screen pb-24 pt-6">
      <div className="app-header">
        <div className="flex items-center gap-4">
          <Link className="app-back-button" href="/">
            ←
          </Link>
          <p className="app-brand">RE:MAN</p>
        </div>
        <div className="app-header-actions">
          <CreditStatus variant="badge" />
        </div>
      </div>

      <section className="profile-card mt-5">
        <div>
          <p className="poster-kicker">Profile</p>
          <h1 className="mt-3 text-[44px] font-black leading-none tracking-[-0.07em] text-ink">
            내 정보
          </h1>
        </div>
        <div className="profile-account">
          <div className="profile-avatar">{(displayName[0] ?? "R").toUpperCase()}</div>
          <div className="min-w-0">
            <p className="truncate text-2xl font-black leading-tight tracking-[-0.04em] text-ink">
              {isLoading ? "불러오는 중" : displayName}
            </p>
            <p className="truncate text-sm font-bold text-muted">
              {user?.email ?? "이메일 없음"}
            </p>
          </div>
        </div>
      </section>

      <section className="profile-mini-grid mt-4">
        <div>
          <p className="poster-kicker">Login</p>
          <p>Google</p>
        </div>
        <div>
          <p className="poster-kicker">Program</p>
          <p>{preferredProgramLabel}</p>
        </div>
        <div>
          <p className="poster-kicker">Status</p>
          <p>{statusLabel}</p>
        </div>
        <div>
          <p className="poster-kicker">Data</p>
          <p>보호됨</p>
        </div>
      </section>

      <section aria-label="내 데이터" className="profile-mini-grid mt-4">
        <div>
          <p className="poster-kicker">Closet</p>
          <p>옷장 {dataSummary.closetCount}개</p>
        </div>
        <div>
          <p className="poster-kicker">History</p>
          <p>기록 {dataSummary.historyCount}개</p>
        </div>
        <div>
          <p className="poster-kicker">Feedback</p>
          <p>{dataSummary.hasRecommendationFeedback ? "반응 저장됨" : "반응 없음"}</p>
        </div>
        <div>
          <p className="poster-kicker">Reuse</p>
          <p>다음 체크 반영</p>
        </div>
      </section>

      <div className="mt-5">
        <CreditLedger />
      </div>

      <section className="mt-7 space-y-3">
        <div className="section-heading">
          <p className="poster-kicker">Manage</p>
          <h2>관리</h2>
        </div>
        <div className="profile-action-grid">
          <Link className="profile-action-card" href="/settings">
            <span>설정</span>
            <span>→</span>
          </Link>
          <Link className="profile-action-card" href="/closet">
            <span>옷장</span>
            <span>→</span>
          </Link>
          <Link className="profile-action-card" href="/history">
            <span>기록</span>
            <span>→</span>
          </Link>
          <Link className="profile-action-card" href="/programs/style/onboarding/upload?reset=photo">
            <span>새 체크</span>
            <span>→</span>
          </Link>
        </div>
      </section>

      <button
        className="ui-button-secondary mt-7 h-12 w-full"
        disabled={isLoggingOut}
        onClick={() => void handleLogout()}
        type="button"
      >
        {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
      </button>
    </main>
  );
}
