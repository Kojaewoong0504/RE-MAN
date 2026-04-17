export const INITIAL_FREE_CREDITS = 3;
export const INITIAL_EVENT_CREDITS = INITIAL_FREE_CREDITS;
export const STYLE_FEEDBACK_CREDIT_COST = 1;
export const TRY_ON_CREDIT_COST = 1;

type CreditAccount = {
  eventCredits: number;
  paidCredits: number;
  subscriptionActive: boolean;
  updatedAt: string;
};

export type CreditTransactionType =
  | "grant_event"
  | "grant_paid"
  | "debit"
  | "refund"
  | "subscription_usage"
  | "subscription_update";

export type CreditTransaction = {
  id: string;
  user_id: string;
  type: CreditTransactionType;
  delta: number;
  event_delta: number;
  paid_delta: number;
  balance_after: number;
  event_balance_after: number;
  paid_balance_after: number;
  subscription_active_after: boolean;
  reason: string;
  reference_id: string | null;
  idempotency_key: string | null;
  created_at: string;
  source: "memory";
};

export type CreditBalance = {
  balance: number;
  event_credits: number;
  paid_credits: number;
  subscription_active: boolean;
  included_free_credits: number;
  style_feedback_cost: number;
  try_on_cost: number;
  source: "memory";
};

export type CreditAuditSnapshot = {
  ok: boolean;
  balance: CreditBalance;
  ledger_balance: number;
  ledger_event_credits: number;
  ledger_paid_credits: number;
  transaction_count: number;
  latest_transaction_id: string | null;
  mismatches: string[];
  source: "memory";
};

export class InsufficientCreditsError extends Error {
  balance: number;
  cost: number;

  constructor(balance: number, cost: number) {
    super("insufficient_credits");
    this.name = "InsufficientCreditsError";
    this.balance = balance;
    this.cost = cost;
  }
}

type CreditOperationOptions = {
  reason?: string;
  referenceId?: string | null;
  idempotencyKey?: string | null;
};

type CreditOperationResult = CreditBalance & {
  idempotent_replay: boolean;
  replayed_reference_id: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __remanCreditAccounts: Map<string, CreditAccount> | undefined;
  // eslint-disable-next-line no-var
  var __remanCreditTransactions: Map<string, CreditTransaction[]> | undefined;
}

function getCreditStore() {
  if (!globalThis.__remanCreditAccounts) {
    globalThis.__remanCreditAccounts = new Map<string, CreditAccount>();
  }

  return globalThis.__remanCreditAccounts;
}

function getCreditTransactionStore() {
  if (!globalThis.__remanCreditTransactions) {
    globalThis.__remanCreditTransactions = new Map<string, CreditTransaction[]>();
  }

  return globalThis.__remanCreditTransactions;
}

function createTransactionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `credit-tx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function appendCreditTransaction({
  userId,
  account,
  type,
  eventDelta,
  paidDelta,
  reason,
  referenceId = null,
  idempotencyKey = null,
  createdAt = new Date().toISOString()
}: {
  userId: string;
  account: CreditAccount;
  type: CreditTransactionType;
  eventDelta: number;
  paidDelta: number;
  reason: string;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  createdAt?: string;
}) {
  const transactionStore = getCreditTransactionStore();
  const existing = transactionStore.get(userId) ?? [];
  const normalizedEventDelta = Object.is(eventDelta, -0) ? 0 : eventDelta;
  const normalizedPaidDelta = Object.is(paidDelta, -0) ? 0 : paidDelta;
  const transaction: CreditTransaction = {
    id: createTransactionId(),
    user_id: userId,
    type,
    delta: normalizedEventDelta + normalizedPaidDelta,
    event_delta: normalizedEventDelta,
    paid_delta: normalizedPaidDelta,
    balance_after: account.eventCredits + account.paidCredits,
    event_balance_after: account.eventCredits,
    paid_balance_after: account.paidCredits,
    subscription_active_after: account.subscriptionActive,
    reason,
    reference_id: referenceId,
    idempotency_key: idempotencyKey,
    created_at: createdAt,
    source: "memory"
  };

  transactionStore.set(userId, [transaction, ...existing]);
  return transaction;
}

function withCreditOperationMeta(
  balance: CreditBalance,
  meta?: Partial<Pick<CreditOperationResult, "idempotent_replay" | "replayed_reference_id">>
): CreditOperationResult {
  return {
    ...balance,
    idempotent_replay: meta?.idempotent_replay ?? false,
    replayed_reference_id: meta?.replayed_reference_id ?? null
  };
}

function findCompletedIdempotentTransaction(userId: string, idempotencyKey?: string | null) {
  if (!idempotencyKey) {
    return null;
  }

  const transactions = getCreditTransactionStore().get(userId) ?? [];
  const latestMatchingTransaction = transactions.find(
    (transaction) =>
      transaction.idempotency_key === idempotencyKey &&
      (transaction.type === "debit" ||
        transaction.type === "refund" ||
        transaction.type === "subscription_usage")
  );

  if (!latestMatchingTransaction || latestMatchingTransaction.type === "refund") {
    return null;
  }

  return latestMatchingTransaction;
}

function getOrCreateAccount(userId: string) {
  const store = getCreditStore();
  const existing = store.get(userId);

  if (existing) {
    return existing;
  }

  const account = {
    eventCredits: INITIAL_EVENT_CREDITS,
    paidCredits: 0,
    subscriptionActive: false,
    updatedAt: new Date().toISOString()
  };

  store.set(userId, account);
  appendCreditTransaction({
    userId,
    account,
    type: "grant_event",
    eventDelta: INITIAL_EVENT_CREDITS,
    paidDelta: 0,
    reason: "initial_event_allowance"
  });

  return account;
}

export function getCreditBalance(userId: string): CreditBalance {
  const account = getOrCreateAccount(userId);
  const balance = account.eventCredits + account.paidCredits;

  return {
    balance,
    event_credits: account.eventCredits,
    paid_credits: account.paidCredits,
    subscription_active: account.subscriptionActive,
    included_free_credits: INITIAL_EVENT_CREDITS,
    style_feedback_cost: STYLE_FEEDBACK_CREDIT_COST,
    try_on_cost: TRY_ON_CREDIT_COST,
    source: "memory"
  };
}

export function reserveCredits(
  userId: string,
  cost: number,
  options: CreditOperationOptions = {}
) {
  const completedTransaction = findCompletedIdempotentTransaction(
    userId,
    options.idempotencyKey
  );

  if (completedTransaction) {
    return withCreditOperationMeta(getCreditBalance(userId), {
      idempotent_replay: true,
      replayed_reference_id: completedTransaction.reference_id
    });
  }

  const store = getCreditStore();
  const account = getOrCreateAccount(userId);
  const balance = account.eventCredits + account.paidCredits;

  if (balance < cost) {
    throw new InsufficientCreditsError(balance, cost);
  }

  const eventCreditsToUse = Math.min(account.eventCredits, cost);
  const paidCreditsToUse = cost - eventCreditsToUse;
  const nextAccount = {
    ...account,
    eventCredits: account.eventCredits - eventCreditsToUse,
    paidCredits: account.paidCredits - paidCreditsToUse,
    updatedAt: new Date().toISOString()
  };

  store.set(userId, nextAccount);
  appendCreditTransaction({
    userId,
    account: nextAccount,
    type: "debit",
    eventDelta: -eventCreditsToUse,
    paidDelta: -paidCreditsToUse,
    reason: options.reason ?? "credit_usage",
    referenceId: options.referenceId ?? null,
    idempotencyKey: options.idempotencyKey ?? null
  });

  return withCreditOperationMeta(getCreditBalance(userId));
}

export function refundCredits(
  userId: string,
  amount: number,
  options: CreditOperationOptions = {}
) {
  const store = getCreditStore();
  const account = getOrCreateAccount(userId);

  const nextAccount = {
    ...account,
    eventCredits: account.eventCredits + amount,
    updatedAt: new Date().toISOString()
  };

  store.set(userId, nextAccount);
  appendCreditTransaction({
    userId,
    account: nextAccount,
    type: "refund",
    eventDelta: amount,
    paidDelta: 0,
    reason: options.reason ?? "usage_refund",
    referenceId: options.referenceId ?? null,
    idempotencyKey: options.idempotencyKey ?? null
  });

  return withCreditOperationMeta(getCreditBalance(userId));
}

export function hasActiveSubscription(userId: string) {
  return getOrCreateAccount(userId).subscriptionActive;
}

export function setSubscriptionForTests(userId: string, active: boolean) {
  const store = getCreditStore();
  const account = getOrCreateAccount(userId);

  const nextAccount = {
    ...account,
    subscriptionActive: active,
    updatedAt: new Date().toISOString()
  };

  store.set(userId, nextAccount);
  appendCreditTransaction({
    userId,
    account: nextAccount,
    type: "subscription_update",
    eventDelta: 0,
    paidDelta: 0,
    reason: active ? "subscription_activated" : "subscription_deactivated"
  });

  return getCreditBalance(userId);
}

export function grantPaidCreditsForTests(userId: string, amount: number) {
  const store = getCreditStore();
  const account = getOrCreateAccount(userId);

  const nextAccount = {
    ...account,
    paidCredits: account.paidCredits + amount,
    updatedAt: new Date().toISOString()
  };

  store.set(userId, nextAccount);
  appendCreditTransaction({
    userId,
    account: nextAccount,
    type: "grant_paid",
    eventDelta: 0,
    paidDelta: amount,
    reason: "paid_credit_grant"
  });

  return getCreditBalance(userId);
}

export function reserveEntitledUsage(
  userId: string,
  cost: number,
  options: CreditOperationOptions = {}
) {
  if (hasActiveSubscription(userId)) {
    const completedTransaction = findCompletedIdempotentTransaction(
      userId,
      options.idempotencyKey
    );

    if (completedTransaction) {
      return {
        charged: false,
        credits: withCreditOperationMeta(getCreditBalance(userId), {
          idempotent_replay: true,
          replayed_reference_id: completedTransaction.reference_id
        })
      };
    }

    appendCreditTransaction({
      userId,
      account: getOrCreateAccount(userId),
      type: "subscription_usage",
      eventDelta: 0,
      paidDelta: 0,
      reason: options.reason ?? "subscription_entitled_usage",
      referenceId: options.referenceId ?? null,
      idempotencyKey: options.idempotencyKey ?? null
    });

    return {
      charged: false,
      credits: withCreditOperationMeta(getCreditBalance(userId))
    };
  }

  return {
    charged: true,
    credits: reserveCredits(userId, cost, options)
  };
}

export function getCreditTransactions(userId: string, limit = 50) {
  getOrCreateAccount(userId);
  const transactions = getCreditTransactionStore().get(userId) ?? [];

  return transactions.slice(0, limit);
}

export function getCreditAuditSnapshot(userId: string): CreditAuditSnapshot {
  const balance = getCreditBalance(userId);
  const transactions = getCreditTransactionStore().get(userId) ?? [];
  const chronologicalTransactions = [...transactions].reverse();
  const ledger = chronologicalTransactions.reduce(
    (accumulator, transaction) => ({
      eventCredits: accumulator.eventCredits + transaction.event_delta,
      paidCredits: accumulator.paidCredits + transaction.paid_delta
    }),
    {
      eventCredits: 0,
      paidCredits: 0
    }
  );
  const ledgerBalance = ledger.eventCredits + ledger.paidCredits;
  const mismatches: string[] = [];

  if (ledger.eventCredits !== balance.event_credits) {
    mismatches.push("event_credits");
  }

  if (ledger.paidCredits !== balance.paid_credits) {
    mismatches.push("paid_credits");
  }

  if (ledgerBalance !== balance.balance) {
    mismatches.push("balance");
  }

  return {
    ok: mismatches.length === 0,
    balance,
    ledger_balance: ledgerBalance,
    ledger_event_credits: ledger.eventCredits,
    ledger_paid_credits: ledger.paidCredits,
    transaction_count: transactions.length,
    latest_transaction_id: transactions[0]?.id ?? null,
    mismatches,
    source: "memory"
  };
}

export function resetCreditsForTests() {
  getCreditStore().clear();
  getCreditTransactionStore().clear();
}
