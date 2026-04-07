"use client";

import { useState } from "react";
import { syncSurveyToFirestore } from "@/lib/firebase/firestore";
import { hasFirebaseClientConfig } from "@/lib/firebase/client";
import { upgradeAnonymousSessionToGoogle } from "@/lib/firebase/session";
import { patchOnboardingState, readOnboardingState } from "@/lib/onboarding/storage";

export function GoogleUpgradeCard() {
  const [status, setStatus] = useState(
    "이제 마음에 든 변화만 남기면 됩니다. 계속 이어가고 싶다면 Google 계정으로 연결해두세요."
  );
  const [isLoading, setIsLoading] = useState(false);

  async function handleUpgrade() {
    setIsLoading(true);

    try {
      const result = await upgradeAnonymousSessionToGoogle();
      const nextState = patchOnboardingState({
        user_id: result.uid,
        email: result.email ?? undefined
      });

      await syncSurveyToFirestore(nextState);
      setStatus(
        result.email
          ? `Google 계정 ${result.email} 로 연결했습니다. 지금까지의 7일 기록은 그대로 이어집니다.`
          : "Google 계정으로 연결했습니다. 지금까지의 7일 기록은 그대로 이어집니다."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_google_link_error";
      const currentEmail = readOnboardingState().email;

      if (message === "auth/popup-closed-by-user") {
        setStatus("Google 로그인 창이 닫혔습니다. 원할 때 다시 연결하면 됩니다.");
        return;
      }

      if (message === "auth/cancelled-popup-request") {
        setStatus("Google 로그인 요청이 겹쳤습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      if (message === "auth/popup-blocked") {
        setStatus("브라우저가 로그인 팝업을 막았습니다. 팝업 허용 후 다시 시도해 주세요.");
        return;
      }

      if (currentEmail) {
        setStatus(
          `이미 ${currentEmail} 계정으로 연결된 상태일 수 있습니다. 필요하면 나중에 다시 확인해 주세요.`
        );
        return;
      }

      setStatus(`Google 계정 연결에 실패했습니다: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-xl bg-surface p-5 text-white">
      <p className="mb-3 text-xs uppercase tracking-[0.22em] text-muted">Keep Going</p>
      <h2 className="text-2xl font-semibold tracking-[-0.03em]">
        다음 주에도 이어가려면 지금 계정을 연결해두세요
      </h2>
      <p className="mt-3 text-base leading-7 text-zinc-300">{status}</p>
      <button
        className="mt-5 flex h-12 w-full items-center justify-center rounded-lg bg-white text-black text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
        disabled={isLoading || !hasFirebaseClientConfig()}
        onClick={handleUpgrade}
        type="button"
      >
        {isLoading
          ? "Google 연결 중..."
          : hasFirebaseClientConfig()
            ? "Google 로그인으로 이어가기"
            : "Firebase 설정 후 Google 연결 가능"}
      </button>
    </section>
  );
}
