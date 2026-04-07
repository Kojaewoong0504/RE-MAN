"use client";

import { useState } from "react";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";

type FeedbackFlowProps = {
  diagnosis: string;
  improvements: string[];
  todayAction: string;
  closingLabel: string;
};

export function FeedbackFlow({
  diagnosis,
  improvements,
  todayAction,
  closingLabel
}: FeedbackFlowProps) {
  const cards = [
    { label: "진단", body: diagnosis, accent: false },
    ...improvements.map((item, index) => ({
      label: `개선 포인트 ${index + 1}`,
      body: item,
      accent: false
    })),
    { label: closingLabel, body: todayAction, accent: true }
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCard = cards[activeIndex];

  return (
    <div className="space-y-4">
      <FeedbackCard
        label={activeCard.label}
        body={activeCard.body}
        accent={activeCard.accent}
      />
      <div className="grid grid-cols-2 gap-3">
        <button
          className="h-12 rounded-lg bg-white/10 text-sm font-medium text-white disabled:opacity-40"
          disabled={activeIndex === 0}
          onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
          type="button"
        >
          이전
        </button>
        <button
          className="h-12 rounded-lg bg-white text-sm font-semibold text-black disabled:opacity-40"
          disabled={activeIndex === cards.length - 1}
          onClick={() =>
            setActiveIndex((current) => Math.min(cards.length - 1, current + 1))
          }
          type="button"
        >
          다음
        </button>
      </div>
    </div>
  );
}
