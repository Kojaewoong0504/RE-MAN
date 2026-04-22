"use client";

import type { CreditStatusPayload } from "@/lib/credits/types";

const CREDIT_STATUS_CACHE_TTL_MS = 15_000;
const CREDIT_STATUS_EVENT = "reman:credit-status-changed";

let cachedCreditStatus: CreditStatusPayload | undefined;
let cachedCreditStatusAt = 0;
let pendingCreditStatusRequest: Promise<CreditStatusPayload | null> | null = null;

function emitCreditStatusChanged(credits: CreditStatusPayload | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(CREDIT_STATUS_EVENT, {
      detail: { credits }
    })
  );
}

export function readFreshCachedCreditStatus() {
  if (cachedCreditStatus === undefined) {
    return undefined;
  }

  if (Date.now() - cachedCreditStatusAt > CREDIT_STATUS_CACHE_TTL_MS) {
    return undefined;
  }

  return cachedCreditStatus;
}

export function primeCreditStatusCache(credits: CreditStatusPayload | null | undefined) {
  if (!credits) {
    return null;
  }

  cachedCreditStatus = credits;
  cachedCreditStatusAt = Date.now();
  emitCreditStatusChanged(credits);
  return credits;
}

export function clearCreditStatusCache() {
  cachedCreditStatus = undefined;
  cachedCreditStatusAt = 0;
  pendingCreditStatusRequest = null;
  emitCreditStatusChanged(null);
}

export function patchCreditStatusCache(input: {
  balance: number;
  subscription_active?: boolean;
  style_feedback_cost?: number;
}) {
  const current = readFreshCachedCreditStatus() ?? cachedCreditStatus ?? null;
  const next: CreditStatusPayload = {
    balance: input.balance,
    event_credits: current?.event_credits ?? 0,
    paid_credits: current?.paid_credits ?? 0,
    subscription_active: input.subscription_active ?? current?.subscription_active ?? false,
    style_feedback_cost: input.style_feedback_cost ?? current?.style_feedback_cost ?? 1
  };

  return primeCreditStatusCache(next);
}

export function subscribeCreditStatusChange(
  listener: (credits: CreditStatusPayload | null) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ credits: CreditStatusPayload | null }>;
    listener(customEvent.detail.credits);
  };

  window.addEventListener(CREDIT_STATUS_EVENT, handler);

  return () => {
    window.removeEventListener(CREDIT_STATUS_EVENT, handler);
  };
}

export async function loadCreditStatus() {
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

      return primeCreditStatusCache(data);
    })
    .catch(() => null)
    .finally(() => {
      pendingCreditStatusRequest = null;
    });

  return pendingCreditStatusRequest;
}
