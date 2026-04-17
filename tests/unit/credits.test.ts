import { beforeEach, describe, expect, it } from "vitest";
import {
  getCreditBalance,
  getCreditAuditSnapshot,
  getCreditTransactions,
  grantPaidCreditsForTests,
  INITIAL_FREE_CREDITS,
  InsufficientCreditsError,
  refundCredits,
  reserveCredits,
  reserveEntitledUsage,
  resetCreditsForTests,
  setSubscriptionForTests,
  STYLE_FEEDBACK_CREDIT_COST,
  TRY_ON_CREDIT_COST
} from "@/lib/credits/server";

describe("credit ledger v0", () => {
  beforeEach(() => {
    resetCreditsForTests();
  });

  it("starts new users with the free credit allowance", () => {
    expect(getCreditBalance("user-1")).toMatchObject({
      balance: INITIAL_FREE_CREDITS,
      event_credits: INITIAL_FREE_CREDITS,
      paid_credits: 0,
      subscription_active: false,
      included_free_credits: INITIAL_FREE_CREDITS,
      style_feedback_cost: STYLE_FEEDBACK_CREDIT_COST,
      try_on_cost: TRY_ON_CREDIT_COST,
      source: "memory"
    });
    expect(getCreditTransactions("user-1")[0]).toMatchObject({
      type: "grant_event",
      delta: INITIAL_FREE_CREDITS,
      event_delta: INITIAL_FREE_CREDITS,
      paid_delta: 0,
      balance_after: INITIAL_FREE_CREDITS,
      reason: "initial_event_allowance"
    });
    expect(getCreditAuditSnapshot("user-1")).toMatchObject({
      ok: true,
      ledger_balance: INITIAL_FREE_CREDITS,
      ledger_event_credits: INITIAL_FREE_CREDITS,
      ledger_paid_credits: 0,
      transaction_count: 1,
      mismatches: []
    });
  });

  it("reserves credits before cost-bearing try-on generation", () => {
    expect(
      reserveCredits("user-1", TRY_ON_CREDIT_COST, {
        reason: "try_on_generation",
        referenceId: "try-on-1"
      }).balance
    ).toBe(
      INITIAL_FREE_CREDITS - TRY_ON_CREDIT_COST
    );
    expect(getCreditTransactions("user-1")[0]).toMatchObject({
      type: "debit",
      delta: -TRY_ON_CREDIT_COST,
      event_delta: -TRY_ON_CREDIT_COST,
      paid_delta: 0,
      balance_after: INITIAL_FREE_CREDITS - TRY_ON_CREDIT_COST,
      reason: "try_on_generation",
      reference_id: "try-on-1"
    });
  });

  it("does not debit twice for the same completed idempotency key", () => {
    const first = reserveCredits("user-1", TRY_ON_CREDIT_COST, {
      reason: "try_on_generation",
      referenceId: "try-on-idempotent-1",
      idempotencyKey: "try-on-request-1"
    });
    const second = reserveCredits("user-1", TRY_ON_CREDIT_COST, {
      reason: "try_on_generation",
      referenceId: "try-on-idempotent-2",
      idempotencyKey: "try-on-request-1"
    });

    expect(first).toMatchObject({
      balance: INITIAL_FREE_CREDITS - TRY_ON_CREDIT_COST,
      idempotent_replay: false,
      replayed_reference_id: null
    });
    expect(second).toMatchObject({
      balance: INITIAL_FREE_CREDITS - TRY_ON_CREDIT_COST,
      idempotent_replay: true,
      replayed_reference_id: "try-on-idempotent-1"
    });
    expect(getCreditTransactions("user-1").filter((transaction) => transaction.type === "debit")).toHaveLength(1);
  });

  it("allows retry with the same idempotency key after a refunded failure", () => {
    reserveCredits("user-1", TRY_ON_CREDIT_COST, {
      reason: "try_on_generation",
      referenceId: "try-on-failed-1",
      idempotencyKey: "retry-after-refund"
    });
    refundCredits("user-1", TRY_ON_CREDIT_COST, {
      reason: "try_on_failed_refund",
      referenceId: "try-on-failed-1",
      idempotencyKey: "retry-after-refund"
    });
    const retry = reserveCredits("user-1", TRY_ON_CREDIT_COST, {
      reason: "try_on_generation",
      referenceId: "try-on-retry-1",
      idempotencyKey: "retry-after-refund"
    });

    expect(retry).toMatchObject({
      balance: INITIAL_FREE_CREDITS - TRY_ON_CREDIT_COST,
      idempotent_replay: false
    });
    expect(getCreditTransactions("user-1").filter((transaction) => transaction.type === "debit")).toHaveLength(2);
  });

  it("throws a structured error when the balance is insufficient", () => {
    reserveCredits("user-1", 3);

    expect(() => reserveCredits("user-1", 1)).toThrow(InsufficientCreditsError);
    expect(getCreditBalance("user-1").balance).toBe(0);
  });

  it("refunds reserved credits when provider generation fails", () => {
    reserveCredits("user-1", TRY_ON_CREDIT_COST, {
      reason: "try_on_generation",
      referenceId: "try-on-2"
    });
    refundCredits("user-1", TRY_ON_CREDIT_COST, {
      reason: "try_on_failed_refund",
      referenceId: "try-on-2"
    });

    expect(getCreditBalance("user-1").balance).toBe(INITIAL_FREE_CREDITS);
    expect(getCreditTransactions("user-1")[0]).toMatchObject({
      type: "refund",
      delta: TRY_ON_CREDIT_COST,
      reason: "try_on_failed_refund",
      reference_id: "try-on-2"
    });
  });

  it("allows subscribed users without consuming credits", () => {
    setSubscriptionForTests("user-1", true);

    const usage = reserveEntitledUsage("user-1", STYLE_FEEDBACK_CREDIT_COST);

    expect(usage.charged).toBe(false);
    expect(getCreditBalance("user-1").balance).toBe(INITIAL_FREE_CREDITS);
    expect(getCreditBalance("user-1").subscription_active).toBe(true);
    expect(getCreditTransactions("user-1")[0]).toMatchObject({
      type: "subscription_usage",
      delta: 0,
      reason: "subscription_entitled_usage"
    });
  });

  it("uses event credits before paid credits", () => {
    grantPaidCreditsForTests("user-1", 2);
    reserveCredits("user-1", INITIAL_FREE_CREDITS + 1);

    expect(getCreditBalance("user-1")).toMatchObject({
      event_credits: 0,
      paid_credits: 1,
      balance: 1
    });
    expect(getCreditTransactions("user-1").map((transaction) => transaction.type)).toEqual([
      "debit",
      "grant_paid",
      "grant_event"
    ]);
    expect(getCreditAuditSnapshot("user-1")).toMatchObject({
      ok: true,
      ledger_balance: 1,
      ledger_event_credits: 0,
      ledger_paid_credits: 1,
      transaction_count: 3,
      mismatches: []
    });
  });
});
