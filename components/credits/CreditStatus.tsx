"use client";

import { useEffect, useState } from "react";
import {
  fetchAuthSession,
  readCachedAuthSessionSnapshot,
  subscribeAuthSessionChange
} from "@/lib/auth/client";
import {
  clearCreditStatusCache,
  loadCreditStatus,
  readFreshCachedCreditStatus
} from "@/lib/credits/client";
import type { CreditStatusPayload } from "@/lib/credits/types";

type CreditStatusProps = {
  compact?: boolean;
  variant?: "panel" | "badge";
};

function getCreditStatusCopy(credits: CreditStatusPayload) {
  if (credits.subscription_active) {
    return {
      value: "구독",
      label: "활성",
      detail: "스타일 체크 가능"
    };
  }

  return {
    value: `${credits.balance}`,
    label: "크레딧",
    detail:
      credits.balance >= credits.style_feedback_cost
        ? `체크 ${Math.floor(credits.balance / credits.style_feedback_cost)}회`
        : "크레딧 부족"
  };
}

export function CreditStatus({ compact = false, variant = "panel" }: CreditStatusProps) {
  const [credits, setCredits] = useState<CreditStatusPayload | null>(
    () => readFreshCachedCreditStatus() ?? null
  );

  useEffect(() => {
    let active = true;

    async function sync() {
      const cachedSession = readCachedAuthSessionSnapshot();
      const session =
        cachedSession === undefined
          ? await fetchAuthSession({ includeCredits: true })
          : cachedSession;

      if (!active || !session) {
        if (active) {
          setCredits(null);
        }

        return;
      }

      const nextCredits = await loadCreditStatus();

      if (active && nextCredits) {
        setCredits(nextCredits);
      }
    }

    void sync();
    const unsubscribe = subscribeAuthSessionChange((user) => {
      clearCreditStatusCache();

      if (!user) {
        setCredits(null);
        return;
      }

      void sync();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!credits) {
    return null;
  }

  const copy = getCreditStatusCopy(credits);

  if (variant === "badge") {
    return (
      <div aria-label="사용 가능한 크레딧" className="credit-status-badge">
        <span>{copy.detail}</span>
      </div>
    );
  }

  return (
    <section className={compact ? "credit-status credit-status-compact" : "credit-status"}>
      <div>
        <p className="poster-kicker">Credits</p>
        <p>{copy.detail}</p>
      </div>
      <div aria-label="사용 가능한 크레딧">
        <strong>{copy.value}</strong>
        <span>{copy.label}</span>
      </div>
    </section>
  );
}
