export const INITIAL_FREE_CREDITS = 3;
export const TRY_ON_CREDIT_COST = 1;

type CreditAccount = {
  balance: number;
  updatedAt: string;
};

export type CreditBalance = {
  balance: number;
  included_free_credits: number;
  try_on_cost: number;
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

declare global {
  // eslint-disable-next-line no-var
  var __remanCreditAccounts: Map<string, CreditAccount> | undefined;
}

function getCreditStore() {
  if (!globalThis.__remanCreditAccounts) {
    globalThis.__remanCreditAccounts = new Map<string, CreditAccount>();
  }

  return globalThis.__remanCreditAccounts;
}

function getOrCreateAccount(userId: string) {
  const store = getCreditStore();
  const existing = store.get(userId);

  if (existing) {
    return existing;
  }

  const account = {
    balance: INITIAL_FREE_CREDITS,
    updatedAt: new Date().toISOString()
  };

  store.set(userId, account);
  return account;
}

export function getCreditBalance(userId: string): CreditBalance {
  const account = getOrCreateAccount(userId);

  return {
    balance: account.balance,
    included_free_credits: INITIAL_FREE_CREDITS,
    try_on_cost: TRY_ON_CREDIT_COST,
    source: "memory"
  };
}

export function reserveCredits(userId: string, cost: number) {
  const store = getCreditStore();
  const account = getOrCreateAccount(userId);

  if (account.balance < cost) {
    throw new InsufficientCreditsError(account.balance, cost);
  }

  const nextAccount = {
    balance: account.balance - cost,
    updatedAt: new Date().toISOString()
  };

  store.set(userId, nextAccount);
  return getCreditBalance(userId);
}

export function refundCredits(userId: string, amount: number) {
  const store = getCreditStore();
  const account = getOrCreateAccount(userId);

  store.set(userId, {
    balance: account.balance + amount,
    updatedAt: new Date().toISOString()
  });

  return getCreditBalance(userId);
}

export function resetCreditsForTests() {
  getCreditStore().clear();
}
