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
    <div className="space-y-5">
      <div className="flex items-center justify-between border-t-2 border-black pt-4">
        <div>
          <p className="poster-kicker">Feedback Flow</p>
          <p className="mt-1 text-sm font-semibold text-muted">
            {activeIndex + 1} / {cards.length}
          </p>
        </div>
        <div className="flex gap-1.5">
          {cards.map((card, index) => (
            <span
              key={card.label}
              className={`block h-2.5 w-8 border border-black ${
                index === activeIndex ? "bg-black" : "bg-transparent"
              }`}
            />
          ))}
        </div>
      </div>
      <FeedbackCard
        label={activeCard.label}
        body={activeCard.body}
        accent={activeCard.accent}
      />
      <div className="grid grid-cols-2 gap-3">
        <button
          className="h-12 border-2 border-black bg-[#fcf8ef] text-sm font-black text-ink disabled:opacity-40"
          disabled={activeIndex === 0}
          onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
          type="button"
        >
          이전
        </button>
        <button
          className="h-12 border-2 border-black bg-accent text-sm font-black text-black disabled:opacity-40"
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
