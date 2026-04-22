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
  const [isGrantingCredits, setIsGrantingCredits] = useState(false);
  const [grantStatus, setGrantStatus] = useState("");
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

  async function handleGrantDevCredits() {
    setIsGrantingCredits(true);
    setGrantStatus("");

    try {
      const response = await fetch("/api/dev/credits/grant", {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("dev_credit_grant_failed");
      }

      const data = (await response.json().catch(() => null)) as
        | { balance?: number; granted?: number }
        | null;

      setGrantStatus(
        `테스트 크레딧 ${data?.granted ?? 10} 지급 · 잔액 ${data?.balance ?? "-"}`
      );
    } catch {
      setGrantStatus("테스트 크레딧 지급 실패");
    } finally {
      setIsGrantingCredits(false);
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
              {user ? displayName : "불러오는 중"}
            </p>
            <p className="truncate text-sm font-bold text-muted">
              {user?.email ?? "이메일 없음"}
            </p>
          </div>
        </div>
      </section>

      <section aria-label="주요 행동" className="profile-primary-actions mt-4">
        <Link
          className="profile-primary-action profile-primary-action-strong"
          href="/programs/style/onboarding/upload?reset=photo"
        >
          <span>새 체크</span>
        </Link>
        <Link className="profile-primary-action" href="/closet">
          <span>옷장</span>
        </Link>
        <Link className="profile-primary-action" href="/history">
          <span>기록</span>
        </Link>
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

      <section aria-label="계정 관리" className="mt-7 space-y-3">
        <div className="section-heading">
          <p className="poster-kicker">Account</p>
          <h2>계정 관리</h2>
        </div>
        <div className="profile-action-grid">
          <Link className="profile-action-card" href="/settings">
            <span>설정</span>
            <span>프로필</span>
          </Link>
          <button
            className="profile-action-card"
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
            type="button"
          >
            <span>{isLoggingOut ? "로그아웃 중" : "로그아웃"}</span>
            <span>계정</span>
          </button>
        </div>
      </section>

      {process.env.NODE_ENV !== "production" ? (
        <section aria-label="개발용 크레딧" className="mt-5 space-y-3">
          <div className="section-heading">
            <p className="poster-kicker">Dev Credits</p>
            <h2>로컬 테스트 충전</h2>
          </div>
          <button
            className="ui-button-secondary h-14 w-full"
            disabled={isGrantingCredits}
            onClick={() => void handleGrantDevCredits()}
            type="button"
          >
            {isGrantingCredits ? "테스트 크레딧 지급 중..." : "테스트 크레딧 10 지급"}
          </button>
          {grantStatus ? (
            <p className="text-sm font-black leading-6 text-ink">{grantStatus}</p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
