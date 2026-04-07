"use client";

import { useEffect, useState } from "react";
import { BottomCTA } from "@/components/common/BottomCTA";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";
import { readOnboardingState } from "@/lib/onboarding/storage";

export default function StorageDevPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(
    "아직 Supabase Storage 업로드/삭제 테스트를 실행하지 않았습니다."
  );
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const state = readOnboardingState();
    setUserId(state.user_id ?? null);
  }, []);

  async function handleSmokeTest() {
    setIsRunning(true);

    try {
      const response = await fetch("/api/dev/storage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ user_id: userId ?? undefined })
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; bucket: string; path: string; deleted: boolean }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !data || data.ok === false) {
        setStatus(
          `Supabase Storage 테스트 실패: ${
            data && "error" in data ? data.error : "unknown_storage_error"
          }`
        );
        return;
      }

      setStatus(
        `Supabase Storage 업로드/삭제 성공: bucket=${data.bucket}, path=${data.path}, deleted=${String(data.deleted)}`
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="app-shell space-y-8">
      <div className="space-y-4 pt-10">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">Storage Dev</p>
        <h1 className="text-4xl font-bold tracking-[-0.04em]">
          로컬에서 Supabase 임시 업로드와 삭제를 확인합니다
        </h1>
        <p className="max-w-md text-base leading-7 text-zinc-300">
          서비스 role 키는 서버 route에서만 사용합니다. 이 페이지는 업로드와 삭제가 한
          요청 안에서 모두 성공하는지 확인하기 위한 로컬 진단용입니다.
        </p>
      </div>
      <FeedbackCard body={userId ?? "익명 세션 없음"} label="Current userId" />
      <FeedbackCard
        accent={status.startsWith("Supabase Storage 업로드/삭제 성공")}
        body={status}
        label="Storage Smoke Test"
      />
      <BottomCTA
        disabled={isRunning}
        label={isRunning ? "Storage 테스트 중..." : "Storage 업로드/삭제 테스트"}
        onClick={handleSmokeTest}
      />
    </main>
  );
}
