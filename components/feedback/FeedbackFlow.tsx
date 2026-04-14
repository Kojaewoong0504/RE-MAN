"use client";

import { useState } from "react";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";

type FeedbackFlowProps = {
  diagnosis: string;
  improvements: string[];
  recommendedOutfit?: {
    title: string;
    items: [string, string, string];
    reason: string;
  };
  todayAction: string;
  closingLabel: string;
};

export function FeedbackFlow({
  diagnosis,
  improvements,
  recommendedOutfit,
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
    ...(recommendedOutfit
      ? [
          {
            label: "추천 조합",
            body: `${recommendedOutfit.title}\n${recommendedOutfit.items.join(" + ")}\n${recommendedOutfit.reason}`,
            accent: false
          }
        ]
      : []),
    { label: closingLabel, body: todayAction, accent: true }
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCard = cards[activeIndex];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-t border-black/15 pt-4">
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
              className={`block h-1.5 w-8 ${
                index === activeIndex ? "bg-black" : "bg-black/10"
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
          className="ui-button-secondary"
          disabled={activeIndex === 0}
          onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
          type="button"
        >
          이전
        </button>
        <button
          className="ui-button-accent"
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
