"use client";

import { useEffect, useState } from "react";
import { BottomCTA } from "@/components/common/BottomCTA";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";
import {
  getFirebaseConnectionMode,
  hasFirebaseClientConfig,
  isFirebaseEmulatorEnabled
} from "@/lib/firebase/client";
import { runFirebaseSmokeWrite } from "@/lib/firebase/firestore";
import { getFirebaseAuthInstance } from "@/lib/firebase/client";
import { patchOnboardingState, readOnboardingState } from "@/lib/onboarding/storage";

export default function FirebaseDevPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("세션 확인 대기 중");
  const [writeStatus, setWriteStatus] = useState<string>("아직 Firestore 쓰기 테스트를 실행하지 않았습니다.");
  const [isWriting, setIsWriting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const storedState = readOnboardingState();

      if (storedState.user_id) {
        setUserId(storedState.user_id);
        setStatus("localStorage에 저장된 userId를 읽었습니다.");
      }

      const auth = getFirebaseAuthInstance();

      if (cancelled) {
        return;
      }

      if (!auth) {
        setStatus("Firebase 설정이 없어 세션 확인을 건너뛰었습니다.");
        return;
      }

      if (typeof auth.authStateReady === "function") {
        await auth.authStateReady();
      }

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setStatus("현재 로그인된 Firebase 사용자가 없습니다.");
        return;
      }

      patchOnboardingState({
        user_id: currentUser.uid,
        email: currentUser.email ?? undefined
      });
      setUserId(currentUser.uid);
      setStatus("Google 로그인 세션을 확인했습니다.");
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSmokeWrite() {
    if (!userId) {
      setWriteStatus("로그인된 세션이 아직 없습니다.");
      return;
    }

    setIsWriting(true);

    try {
      const path = await runFirebaseSmokeWrite(userId);
      setWriteStatus(`Firestore 쓰기 성공: ${path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_firebase_error";
      setWriteStatus(`Firestore 쓰기 실패: ${message}`);
    } finally {
      setIsWriting(false);
    }
  }

  return (
    <main className="app-shell space-y-8">
      <div className="space-y-4 pt-10">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">Firebase Dev</p>
        <h1 className="text-4xl font-bold tracking-[-0.04em]">
          로컬에서 Google 로그인과 Firestore 쓰기를 확인합니다
        </h1>
        <p className="max-w-md text-base leading-7 text-zinc-300">
          프로덕션 배포와 분리된 로컬 진단 페이지입니다. emulator 또는 개발 프로젝트에만
          연결해서 확인하세요.
        </p>
      </div>

      <FeedbackCard
        body={hasFirebaseClientConfig() ? "Firebase client config를 읽었습니다." : "Firebase client config가 없습니다."}
        label="Client Config"
        accent={hasFirebaseClientConfig()}
      />
      <FeedbackCard
        body={`현재 연결 모드: ${getFirebaseConnectionMode()} / emulator enabled: ${isFirebaseEmulatorEnabled() ? "yes" : "no"}`}
        label="Connection Mode"
      />
      <FeedbackCard body={status} label="Firebase Session" />
      <FeedbackCard body={userId ?? "세션 없음"} label="Current userId" />
      <FeedbackCard body={writeStatus} label="Firestore Write" accent={writeStatus.startsWith("Firestore 쓰기 성공")} />

      <BottomCTA
        disabled={isWriting || !hasFirebaseClientConfig()}
        label={isWriting ? "Firestore 쓰는 중..." : "Firestore 쓰기 테스트"}
        onClick={handleSmokeWrite}
      />
    </main>
  );
}
