"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomCTA } from "@/components/common/BottomCTA";
import { ProgressBar } from "@/components/common/ProgressBar";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";
import { FeedbackFlow } from "@/components/feedback/FeedbackFlow";
import { PhotoUploader } from "@/components/upload/PhotoUploader";
import type { DailyAgentResponse } from "@/lib/agents/contracts";
import { saveDailyFeedbackToFirestore } from "@/lib/firebase/firestore";
import {
  buildDailyRequest,
  getRecentHistoryPreview,
  patchOnboardingState,
  readOnboardingState,
  syncHistoryFromState
} from "@/lib/onboarding/storage";

type DayPageProps = {
  params: {
    n: string;
  };
};

function getDefaultMission(day: number) {
  if (day === 1) {
    return "오늘은 옷장 안에서 가장 깔끔한 조합 한 벌만 골라 직접 입어보세요.";
  }

  return "어제 피드백에서 가장 쉬운 한 가지만 반영해서 다시 올려보세요.";
}

function getWeeklyWrapUpSummary(day: number) {
  if (day < 7) {
    return null;
  }

  return "처음보다 어떤 변화가 가장 효과 있었는지 하나만 남기면, 다음 주에도 같은 방식으로 덜 흔들리고 옷을 고를 수 있습니다.";
}

function getCompletionBaseline(
  feedback: DailyAgentResponse,
  recentHistory: string[]
) {
  const previousFocus = recentHistory.at(-1);

  if (previousFocus) {
    return `${feedback.today_action} 이 기준만은 다음에도 그대로 가져가세요. 최근 흐름: ${previousFocus}`;
  }

  return `${feedback.today_action} 이 기준만은 다음에도 그대로 가져가세요.`;
}

export default function DayPage({ params }: DayPageProps) {
  const router = useRouter();
  const day = Number(params.n);
  const [mission, setMission] = useState<string>("");
  const [image, setImage] = useState<string | undefined>();
  const [textDescription, setTextDescription] = useState<string | undefined>();
  const [feedback, setFeedback] = useState<DailyAgentResponse | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [completedDays, setCompletedDays] = useState(1);
  const [recentHistory, setRecentHistory] = useState<string[]>([]);
  const [startingDiagnosis, setStartingDiagnosis] = useState<string | null>(null);

  useEffect(() => {
    const state = readOnboardingState();

    if (!state.feedback) {
      router.replace("/programs/style/onboarding/result");
      return;
    }

    if (!Number.isFinite(day) || day < 1 || day > 7) {
      router.replace("/programs/style/day/1");
      return;
    }

    if (day === 1) {
      setMission(state.feedback.day1_mission);
      setCompletedDays(1);
      setRecentHistory(getRecentHistoryPreview(state));
      setStartingDiagnosis(state.feedback.diagnosis);
      return;
    }

    const previousDailyFeedback = state.daily_feedbacks?.[String(day - 1)];
    const currentDailyFeedback = state.daily_feedbacks?.[String(day)];
    const storedCompletedDays = 1 + Object.keys(state.daily_feedbacks ?? {}).length;

    setMission(previousDailyFeedback?.tomorrow_preview ?? getDefaultMission(day));
    setFeedback(currentDailyFeedback ?? null);
    setImage(state.image);
    setTextDescription(state.text_description);
    setFallbackMessage(state.fallback_message ?? null);
    setCompletedDays(Math.max(day - (currentDailyFeedback ? 0 : 1), storedCompletedDays));
    setRecentHistory(getRecentHistoryPreview(state));
    setStartingDiagnosis(state.feedback.diagnosis);
  }, [day, router]);

  const hasInput = useMemo(
    () => Boolean(image || textDescription?.trim()),
    [image, textDescription]
  );

  async function handleDailyFeedback() {
    const state = patchOnboardingState({
      image,
      text_description: textDescription?.trim() ? textDescription.trim() : undefined,
      fallback_message: undefined
    });
    const payload = buildDailyRequest(state, day);

    if (!payload) {
      return;
    }

    setIsLoading(true);
    setFallbackMessage(null);

    try {
      const response = await fetch("/api/daily", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = (await response.json().catch(() => null)) as
        | DailyAgentResponse
        | { fallback_message?: string }
        | null;

      if (!response.ok || !data || ("diagnosis" in data === false)) {
        const fallback =
          data && "fallback_message" in data && typeof data.fallback_message === "string"
            ? data.fallback_message
            : "오늘 피드백을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.";

        patchOnboardingState({ fallback_message: fallback });
        setFallbackMessage(fallback);
        return;
      }

      const nextState = patchOnboardingState({
        daily_feedbacks: {
          ...(state.daily_feedbacks ?? {}),
          [String(day)]: data
        },
        fallback_message: undefined
      });

      const syncedState = syncHistoryFromState(nextState);
      void saveDailyFeedbackToFirestore(syncedState, day, data);
      setFeedback(data);
      setCompletedDays(Math.max(completedDays, day));
      setRecentHistory(getRecentHistoryPreview(syncedState));
    } finally {
      setIsLoading(false);
    }
  }

  if (day === 1) {
    return (
      <main className="app-shell space-y-8">
        <div className="space-y-6 pt-6">
          <div className="flex items-center justify-between border-b-2 border-black pb-4">
            <div className="flex items-center gap-4">
              <button
                className="text-lg"
                onClick={() => router.push("/programs/style/onboarding/result")}
                type="button"
              >
                ←
              </button>
              <p className="text-sm font-black tracking-tight text-ink">RE:MAN</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black bg-[#f1eadb] text-sm font-bold">
              R
            </div>
          </div>
          <div className="space-y-3">
          <ProgressBar current={1} total={7} />
            <p className="poster-kicker">Day 1</p>
          </div>
          <h1 className="text-4xl font-bold tracking-[-0.04em]">
            오늘 미션 하나만 끝내면 됩니다
          </h1>
          <p className="max-w-sm text-base leading-7 text-muted">
            오늘은 피드백보다 실행이 먼저입니다. 옷장 안에서 바로 할 수 있는 한 가지만
            끝내면 됩니다.
          </p>
        </div>
        <FeedbackCard body={mission || getDefaultMission(1)} label="Day 1 Mission" accent />
        <BottomCTA href="/programs/style/day/2" label="Day 2 피드백 시작하기" />
      </main>
    );
  }

  return (
    <main className="app-shell space-y-8">
      <div className="space-y-6 pt-6">
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <button
              className="text-lg"
              onClick={() => router.push(day === 2 ? "/programs/style/day/1" : `/programs/style/day/${day - 1}`)}
              type="button"
            >
              ←
            </button>
            <p className="text-sm font-black tracking-tight text-ink">RE:MAN</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black bg-[#f1eadb] text-sm font-bold">
            R
          </div>
        </div>
        <div className="space-y-3">
        <ProgressBar current={Math.min(day, 7)} total={7} />
          <p className="poster-kicker">Day {day}</p>
        </div>
        {feedback && day === 7 ? (
          <>
            <h1 className="text-4xl font-bold tracking-[-0.04em]">
              7일 피드백을 끝냈습니다
            </h1>
            <p className="max-w-sm text-base leading-7 text-zinc-300">
              처음보다 무엇이 또렷해졌는지 정리하고, 다음 주에도 그대로 가져갈 기준
              하나만 남기면 됩니다.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold tracking-[-0.04em]">
              오늘은 어제보다 한 가지만 더 또렷하게 만듭니다
            </h1>
            <p className="max-w-sm text-base leading-7 text-muted">
              새 옷을 사는 게 아니라, 지금 가진 조합 안에서 한 가지 변화만 확인합니다.
            </p>
          </>
        )}
      </div>
      <FeedbackCard body={mission || getDefaultMission(day)} label="Today's Mission" accent />
      {recentHistory.length > 0 ? (
        <FeedbackCard body={recentHistory.join("\n")} label="Recent Progress" />
      ) : null}
      <PhotoUploader
        image={image}
        onChange={({ image: nextImage, text_description }) => {
          setImage(nextImage);
          setTextDescription(text_description);
        }}
        textDescription={textDescription}
      />
      {isLoading ? (
        <section className="rounded-2xl bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Analyzing</p>
          <p className="mt-4 text-lg leading-7">오늘 코디에서 한 가지 핵심 변화만 읽고 있어요.</p>
        </section>
      ) : null}
      {feedback ? (
        <div className="space-y-4">
          <FeedbackFlow
            closingLabel="오늘 할 것"
            diagnosis={feedback.diagnosis}
            improvements={feedback.improvements}
            todayAction={feedback.today_action}
          />
          {day < 7 ? (
            <FeedbackCard body={feedback.tomorrow_preview} label="Tomorrow Preview" accent />
          ) : (
            <>
              <FeedbackCard
                body={`완료한 일수 ${completedDays}/7일`}
                label="Weekly Progress"
                accent
              />
              {startingDiagnosis ? (
                <FeedbackCard body={startingDiagnosis} label="Before Day 1" />
              ) : null}
              <FeedbackCard body={feedback.diagnosis} label="After Day 7" />
              <FeedbackCard
                body={
                  getWeeklyWrapUpSummary(day) ??
                  "이번 주에 가장 효과 있었던 변화 하나를 다음 주 기준으로 남겨보세요."
                }
                label="Wrap Up"
              />
              <FeedbackCard
                body={getCompletionBaseline(feedback, recentHistory)}
                label="Keep This Going"
              />
            </>
          )}
        </div>
      ) : null}
      {fallbackMessage ? (
        <div className="rounded-2xl border border-black/10 bg-surface p-6">
          <p className="text-sm leading-6 text-ink">{fallbackMessage}</p>
        </div>
      ) : null}
      <BottomCTA
        disabled={isLoading || !hasInput}
        href={feedback && day < 7 ? `/programs/style/day/${day + 1}` : undefined}
        label={
          feedback
            ? day < 7
              ? `Day ${day + 1}로 이동`
              : "온보딩 결과 다시 보기"
            : isLoading
              ? "AI가 읽는 중..."
              : "오늘 피드백 받기"
        }
        onClick={feedback && day === 7 ? () => router.push("/programs/style/onboarding/result") : feedback ? undefined : handleDailyFeedback}
      />
    </main>
  );
}
