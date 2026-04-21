"use client";

import type { CreditStatusPayload } from "@/lib/credits/types";

const CREDIT_STATUS_CACHE_TTL_MS = 15_000;

let cachedCreditStatus: CreditStatusPayload | undefined;
let cachedCreditStatusAt = 0;
let pendingCreditStatusRequest: Promise<CreditStatusPayload | null> | null = null;

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
  return credits;
}

export function clearCreditStatusCache() {
  cachedCreditStatus = undefined;
  cachedCreditStatusAt = 0;
  pendingCreditStatusRequest = null;
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
