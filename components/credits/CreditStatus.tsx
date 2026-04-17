"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession, subscribeAuthSessionChange } from "@/lib/auth/client";

type CreditStatusPayload = {
  balance: number;
  event_credits: number;
  paid_credits: number;
  subscription_active: boolean;
  style_feedback_cost: number;
};

type CreditStatusProps = {
  compact?: boolean;
  variant?: "panel" | "badge";
};

const CREDIT_STATUS_CACHE_TTL_MS = 15_000;

let cachedCreditStatus: CreditStatusPayload | undefined;
let cachedCreditStatusAt = 0;
let pendingCreditStatusRequest: Promise<CreditStatusPayload | null> | null = null;

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

function readFreshCachedCreditStatus() {
  if (cachedCreditStatus === undefined) {
    return undefined;
  }

  if (Date.now() - cachedCreditStatusAt > CREDIT_STATUS_CACHE_TTL_MS) {
    return undefined;
  }

  return cachedCreditStatus;
}

function writeCachedCreditStatus(credits: CreditStatusPayload) {
  cachedCreditStatus = credits;
  cachedCreditStatusAt = Date.now();
  return credits;
}

function clearCreditStatusCache() {
  cachedCreditStatus = undefined;
  cachedCreditStatusAt = 0;
  pendingCreditStatusRequest = null;
}

async function loadCreditStatus() {
  const cached = readFreshCachedCreditStatus();

  if (cached !== undefined) {
    return cached;
  }

  if (pendingCreditStatusRequest) {
    return pendingCreditStatusRequest;
  }

  pendingCreditStatusRequest = fetch("/api/credits", {
    cache: "no-store",
    credentials: "include"
  })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }

      const data = (await response.json().catch(() => null)) as CreditStatusPayload | null;

      if (!data || typeof data.balance !== "number") {
        return null;
      }

      return writeCachedCreditStatus(data);
    })
    .catch(() => null)
    .finally(() => {
      pendingCreditStatusRequest = null;
    });

  return pendingCreditStatusRequest;
}

export function CreditStatus({ compact = false, variant = "panel" }: CreditStatusProps) {
  const [credits, setCredits] = useState<CreditStatusPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function sync() {
      const session = await fetchAuthSession();

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
    const unsubscribe = subscribeAuthSessionChange(() => {
      clearCreditStatusCache();
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
