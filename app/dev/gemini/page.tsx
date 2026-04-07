"use client";

import { useState } from "react";
import { BottomCTA } from "@/components/common/BottomCTA";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";

type GeminiSmokeSuccess = {
  ok: true;
  provider: string;
  feedback: {
    diagnosis: string;
    improvements: [string, string, string];
    today_action: string;
    day1_mission: string;
  };
};

type GeminiSmokeFailure = {
  ok: false;
  error: string;
  provider: string;
};

type GeminiSmokeResult = GeminiSmokeSuccess | GeminiSmokeFailure;

export default function GeminiDevPage() {
  const [status, setStatus] = useState(
    "아직 Gemini smoke test를 실행하지 않았습니다."
  );
  const [feedback, setFeedback] = useState<GeminiSmokeSuccess["feedback"] | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function handleSmokeTest() {
    setIsRunning(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/dev/gemini", {
        method: "POST"
      });
      const data = (await response.json().catch(() => null)) as GeminiSmokeResult | null;

      if (!response.ok || !data || !data.ok) {
        setStatus(
          `Gemini smoke test 실패: ${
            data && "error" in data
              ? `${data.error} (provider=${data.provider})`
              : "unknown_gemini_error"
          }`
        );
        return;
      }

      setFeedback(data.feedback);
      setStatus(`Gemini smoke test 성공: provider=${data.provider}`);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="app-shell space-y-8">
      <div className="space-y-4 pt-10">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">Gemini Dev</p>
        <h1 className="text-4xl font-bold tracking-[-0.04em]">
          로컬에서 실제 Gemini 응답 계약을 확인합니다
        </h1>
        <p className="max-w-md text-base leading-7 text-zinc-300">
          이 페이지는 로컬 개발에서만 쓰는 smoke test입니다. 사진 없이 텍스트 설명만
          넣어 onboarding-agent 계약과 재시도 흐름을 확인합니다.
        </p>
      </div>

      <FeedbackCard
        body={status}
        label="Gemini Smoke Test"
        accent={status.startsWith("Gemini smoke test 성공")}
      />

      {feedback ? (
        <>
          <FeedbackCard body={feedback.diagnosis} label="Diagnosis" accent />
          <FeedbackCard body={feedback.improvements.join("\n")} label="Improvements" />
          <FeedbackCard body={feedback.today_action} label="Today Action" />
          <FeedbackCard body={feedback.day1_mission} label="Day 1 Mission" />
        </>
      ) : null}

      <BottomCTA
        disabled={isRunning}
        label={isRunning ? "Gemini 테스트 중..." : "Gemini smoke test 실행"}
        onClick={handleSmokeTest}
      />
    </main>
  );
}
