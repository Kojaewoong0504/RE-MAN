"use client";

import { useEffect, useState } from "react";
import {
  fetchAuthSession,
  readCachedAuthSessionSnapshot,
  subscribeAuthSessionChange
} from "@/lib/auth/client";

type CreditTransactionType =
  | "grant_event"
  | "grant_paid"
  | "debit"
  | "refund"
  | "subscription_usage"
  | "subscription_update";

type CreditTransaction = {
  id: string;
  type: CreditTransactionType;
  delta: number;
  balance_after: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
};

type CreditLedgerPayload = {
  transactions: CreditTransaction[];
};

const typeLabels: Record<CreditTransactionType, string> = {
  grant_event: "이벤트 지급",
  grant_paid: "유료 지급",
  debit: "사용",
  refund: "환불",
  subscription_usage: "구독 사용",
  subscription_update: "구독 변경"
};

const reasonLabels: Record<string, string> = {
  initial_event_allowance: "시작 크레딧",
  paid_credit_grant: "유료 크레딧",
  style_feedback: "스타일 체크",
  style_feedback_failed_refund: "분석 실패 환불",
  try_on_generation: "실착 생성",
  try_on_failed_refund: "실착 실패 환불",
  subscription_entitled_usage: "구독 권한",
  subscription_activated: "구독 활성화",
  subscription_deactivated: "구독 해제"
};

function formatDelta(delta: number) {
  if (delta > 0) {
    return `+${delta}`;
  }

  return String(delta);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getReasonLabel(reason: string) {
  return reasonLabels[reason] ?? reason.replaceAll("_", " ");
}

async function fetchCreditLedger() {
  const response = await fetch("/api/credits/transactions?limit=3", {
    cache: "no-store",
    credentials: "include"
  }).catch(() => null);

  if (!response?.ok) {
    return [];
  }

  const data = (await response.json().catch(() => null)) as CreditLedgerPayload | null;
  return data?.transactions ?? [];
}

export function CreditLedger() {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function sync() {
      const cachedSession = readCachedAuthSessionSnapshot();
      const session =
        cachedSession === undefined
          ? await fetchAuthSession({ includeCredits: true })
          : cachedSession;

      if (!active) {
        return;
      }

      if (!session) {
        setTransactions([]);
        setIsReady(true);
        return;
      }

      setTransactions(await fetchCreditLedger());
      setIsReady(true);
    }

    void sync();
    const unsubscribe = subscribeAuthSessionChange((user) => {
      if (!user) {
        setTransactions([]);
        setIsReady(true);
        return;
      }

      void sync();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <section className="credit-ledger" aria-label="크레딧 기록">
      <div className="credit-ledger-head">
        <div>
          <p className="poster-kicker">Credit Log</p>
          <h2>크레딧 기록</h2>
        </div>
        <span>최근 3개</span>
      </div>
      {transactions.length > 0 ? (
        <div className="credit-ledger-list">
          {transactions.map((transaction) => (
            <div className="credit-ledger-row" key={transaction.id}>
              <div>
                <strong>{getReasonLabel(transaction.reason)}</strong>
                <span>
                  {typeLabels[transaction.type]} · 잔액 {transaction.balance_after}
                </span>
              </div>
              <div>
                <strong>{formatDelta(transaction.delta)}</strong>
                <span>{formatDate(transaction.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="credit-ledger-empty">기록 없음</p>
      )}
    </section>
  );
}
