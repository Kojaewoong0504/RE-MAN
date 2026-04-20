import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";

export const INITIAL_FREE_CREDITS = 3;
export const INITIAL_EVENT_CREDITS = INITIAL_FREE_CREDITS;
export const STYLE_FEEDBACK_CREDIT_COST = 1;
export const CLOSET_ANALYSIS_CREDIT_COST = 1;
export const TRY_ON_CREDIT_COST = 1;

type CreditAccount = {
  eventCredits: number;
  paidCredits: number;
  subscriptionActive: boolean;
  updatedAt: string;
};

type CreditSource = "memory" | "firestore";

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
  source: CreditSource;
};

export type CreditBalance = {
  balance: number;
  event_credits: number;
  paid_credits: number;
  subscription_active: boolean;
  included_free_credits: number;
  style_feedback_cost: number;
  closet_analysis_cost: number;
  try_on_cost: number;
  source: CreditSource;
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
  source: CreditSource;
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

function resolveCreditLedgerProvider() {
  return process.env.CREDIT_LEDGER_PROVIDER === "firestore" ? "firestore" : "memory";
}

function toCreditBalance(account: CreditAccount, source: CreditSource): CreditBalance {
  return {
    balance: account.eventCredits + account.paidCredits,
    event_credits: account.eventCredits,
    paid_credits: account.paidCredits,
    subscription_active: account.subscriptionActive,
    included_free_credits: INITIAL_EVENT_CREDITS,
    style_feedback_cost: STYLE_FEEDBACK_CREDIT_COST,
    closet_analysis_cost: CLOSET_ANALYSIS_CREDIT_COST,
    try_on_cost: TRY_ON_CREDIT_COST,
    source
  };
}

function createInitialCreditAccount(): CreditAccount {
  return {
    eventCredits: INITIAL_EVENT_CREDITS,
    paidCredits: 0,
    subscriptionActive: false,
    updatedAt: new Date().toISOString()
  };
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
  return toCreditBalance(account, "memory");
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

function getFirestoreCreditRefs(userId: string) {
  const db = getFirebaseAdminFirestore();

  if (!db) {
    throw new Error("missing_firebase_admin_config");
  }

  return {
    accountRef: db.doc(`users/${userId}/credit/account`),
    transactionsRef: db.collection(`users/${userId}/creditTransactions`)
  };
}

function readFirestoreAccountData(data: FirebaseFirestore.DocumentData | undefined) {
  if (!data) {
    return null;
  }

  return {
    eventCredits: Number(data.eventCredits ?? 0),
    paidCredits: Number(data.paidCredits ?? 0),
    subscriptionActive: Boolean(data.subscriptionActive),
    updatedAt:
      typeof data.updatedAt === "string"
        ? data.updatedAt
        : new Date().toISOString()
  } satisfies CreditAccount;
}

function serializeFirestoreAccount(account: CreditAccount) {
  return {
    eventCredits: account.eventCredits,
    paidCredits: account.paidCredits,
    subscriptionActive: account.subscriptionActive,
    updatedAt: account.updatedAt
  };
}

function serializeFirestoreTransaction(transaction: CreditTransaction) {
  return {
    ...transaction,
    source: "firestore" satisfies CreditSource
  };
}

function deserializeFirestoreTransaction(
  id: string,
  data: FirebaseFirestore.DocumentData
): CreditTransaction {
  return {
    id,
    user_id: String(data.user_id ?? ""),
    type: data.type as CreditTransactionType,
    delta: Number(data.delta ?? 0),
    event_delta: Number(data.event_delta ?? 0),
    paid_delta: Number(data.paid_delta ?? 0),
    balance_after: Number(data.balance_after ?? 0),
    event_balance_after: Number(data.event_balance_after ?? 0),
    paid_balance_after: Number(data.paid_balance_after ?? 0),
    subscription_active_after: Boolean(data.subscription_active_after),
    reason: String(data.reason ?? ""),
    reference_id: data.reference_id ? String(data.reference_id) : null,
    idempotency_key: data.idempotency_key ? String(data.idempotency_key) : null,
    created_at:
      typeof data.created_at === "string"
        ? data.created_at
        : new Date().toISOString(),
    source: "firestore"
  };
}

async function getOrCreateFirestoreAccount(userId: string) {
  const { accountRef, transactionsRef } = getFirestoreCreditRefs(userId);
  const snapshot = await accountRef.get();
  const existing = readFirestoreAccountData(snapshot.data());

  if (existing) {
    return existing;
  }

  const account = createInitialCreditAccount();
  const initialTransaction = buildCreditTransaction({
    userId,
    account,
    type: "grant_event",
    eventDelta: INITIAL_EVENT_CREDITS,
    paidDelta: 0,
    reason: "initial_event_allowance",
    source: "firestore"
  });

  await accountRef.set(serializeFirestoreAccount(account), { merge: true });
  await transactionsRef.doc(initialTransaction.id).set(serializeFirestoreTransaction(initialTransaction));

  return account;
}

function buildCreditTransaction({
  userId,
  account,
  type,
  eventDelta,
  paidDelta,
  reason,
  referenceId = null,
  idempotencyKey = null,
  createdAt = new Date().toISOString(),
  source
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
  source: CreditSource;
}) {
  const normalizedEventDelta = Object.is(eventDelta, -0) ? 0 : eventDelta;
  const normalizedPaidDelta = Object.is(paidDelta, -0) ? 0 : paidDelta;

  return {
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
    source
  } satisfies CreditTransaction;
}

async function getFirestoreTransactions(userId: string, limit = 50) {
  await getOrCreateFirestoreAccount(userId);
  const { transactionsRef } = getFirestoreCreditRefs(userId);
  const snapshot = await transactionsRef
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((docSnapshot) =>
    deserializeFirestoreTransaction(docSnapshot.id, docSnapshot.data())
  );
}

async function findCompletedFirestoreIdempotentTransaction(
  userId: string,
  idempotencyKey?: string | null
) {
  if (!idempotencyKey) {
    return null;
  }

  const transactions = await getFirestoreTransactions(userId, 100);
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

async function appendFirestoreTransaction({
  userId,
  account,
  type,
  eventDelta,
  paidDelta,
  reason,
  referenceId = null,
  idempotencyKey = null
}: {
  userId: string;
  account: CreditAccount;
  type: CreditTransactionType;
  eventDelta: number;
  paidDelta: number;
  reason: string;
  referenceId?: string | null;
  idempotencyKey?: string | null;
}) {
  const { transactionsRef } = getFirestoreCreditRefs(userId);
  const transaction = buildCreditTransaction({
    userId,
    account,
    type,
    eventDelta,
    paidDelta,
    reason,
    referenceId,
    idempotencyKey,
    source: "firestore"
  });

  await transactionsRef.doc(transaction.id).set(serializeFirestoreTransaction(transaction));
  return transaction;
}

async function reserveFirestoreCredits(
  userId: string,
  cost: number,
  options: CreditOperationOptions = {}
) {
  const completedTransaction = await findCompletedFirestoreIdempotentTransaction(
    userId,
    options.idempotencyKey
  );

  if (completedTransaction) {
    return withCreditOperationMeta(await getCreditBalanceAsync(userId), {
      idempotent_replay: true,
      replayed_reference_id: completedTransaction.reference_id
    });
  }

  const { accountRef } = getFirestoreCreditRefs(userId);
  const account = await getOrCreateFirestoreAccount(userId);
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

  await accountRef.set(serializeFirestoreAccount(nextAccount), { merge: true });
  await appendFirestoreTransaction({
    userId,
    account: nextAccount,
    type: "debit",
    eventDelta: -eventCreditsToUse,
    paidDelta: -paidCreditsToUse,
    reason: options.reason ?? "credit_usage",
    referenceId: options.referenceId ?? null,
    idempotencyKey: options.idempotencyKey ?? null
  });

  return withCreditOperationMeta(toCreditBalance(nextAccount, "firestore"));
}

export async function getCreditBalanceAsync(userId: string) {
  if (resolveCreditLedgerProvider() !== "firestore") {
    return getCreditBalance(userId);
  }

  const account = await getOrCreateFirestoreAccount(userId);
  return toCreditBalance(account, "firestore");
}

export async function reserveCreditsAsync(
  userId: string,
  cost: number,
  options: CreditOperationOptions = {}
) {
  if (resolveCreditLedgerProvider() !== "firestore") {
    return reserveCredits(userId, cost, options);
  }

  return reserveFirestoreCredits(userId, cost, options);
}

export async function refundCreditsAsync(
  userId: string,
  amount: number,
  options: CreditOperationOptions = {}
) {
  if (resolveCreditLedgerProvider() !== "firestore") {
    return refundCredits(userId, amount, options);
  }

  const { accountRef } = getFirestoreCreditRefs(userId);
  const account = await getOrCreateFirestoreAccount(userId);
  const nextAccount = {
    ...account,
    eventCredits: account.eventCredits + amount,
    updatedAt: new Date().toISOString()
  };

  await accountRef.set(serializeFirestoreAccount(nextAccount), { merge: true });
  await appendFirestoreTransaction({
    userId,
    account: nextAccount,
    type: "refund",
    eventDelta: amount,
    paidDelta: 0,
    reason: options.reason ?? "usage_refund",
    referenceId: options.referenceId ?? null,
    idempotencyKey: options.idempotencyKey ?? null
  });

  return withCreditOperationMeta(toCreditBalance(nextAccount, "firestore"));
}

export async function reserveEntitledUsageAsync(
  userId: string,
  cost: number,
  options: CreditOperationOptions = {}
) {
  if (resolveCreditLedgerProvider() !== "firestore") {
    return reserveEntitledUsage(userId, cost, options);
  }

  const account = await getOrCreateFirestoreAccount(userId);

  if (account.subscriptionActive) {
    const completedTransaction = await findCompletedFirestoreIdempotentTransaction(
      userId,
      options.idempotencyKey
    );

    if (completedTransaction) {
      return {
        charged: false,
        credits: withCreditOperationMeta(await getCreditBalanceAsync(userId), {
          idempotent_replay: true,
          replayed_reference_id: completedTransaction.reference_id
        })
      };
    }

    await appendFirestoreTransaction({
      userId,
      account,
      type: "subscription_usage",
      eventDelta: 0,
      paidDelta: 0,
      reason: options.reason ?? "subscription_entitled_usage",
      referenceId: options.referenceId ?? null,
      idempotencyKey: options.idempotencyKey ?? null
    });

    return {
      charged: false,
      credits: withCreditOperationMeta(toCreditBalance(account, "firestore"))
    };
  }

  return {
    charged: true,
    credits: await reserveFirestoreCredits(userId, cost, options)
  };
}

export async function getCreditTransactionsAsync(userId: string, limit = 50) {
  if (resolveCreditLedgerProvider() !== "firestore") {
    return getCreditTransactions(userId, limit);
  }

  return getFirestoreTransactions(userId, limit);
}

export async function getCreditAuditSnapshotAsync(userId: string): Promise<CreditAuditSnapshot> {
  if (resolveCreditLedgerProvider() !== "firestore") {
    return getCreditAuditSnapshot(userId);
  }

  const balance = await getCreditBalanceAsync(userId);
  const transactions = await getFirestoreTransactions(userId, 1000);
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
    source: "firestore"
  };
}
