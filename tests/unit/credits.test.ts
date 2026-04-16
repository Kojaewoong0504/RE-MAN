import { beforeEach, describe, expect, it } from "vitest";
import {
  getCreditBalance,
  INITIAL_FREE_CREDITS,
  InsufficientCreditsError,
  refundCredits,
  reserveCredits,
  resetCreditsForTests,
  TRY_ON_CREDIT_COST
} from "@/lib/credits/server";

describe("credit ledger v0", () => {
  beforeEach(() => {
    resetCreditsForTests();
  });

  it("starts new users with the free credit allowance", () => {
    expect(getCreditBalance("user-1")).toMatchObject({
      balance: INITIAL_FREE_CREDITS,
      included_free_credits: INITIAL_FREE_CREDITS,
      try_on_cost: TRY_ON_CREDIT_COST,
      source: "memory"
    });
  });

  it("reserves credits before cost-bearing try-on generation", () => {
    expect(reserveCredits("user-1", TRY_ON_CREDIT_COST).balance).toBe(
      INITIAL_FREE_CREDITS - TRY_ON_CREDIT_COST
    );
  });

  it("throws a structured error when the balance is insufficient", () => {
    reserveCredits("user-1", 3);

    expect(() => reserveCredits("user-1", 1)).toThrow(InsufficientCreditsError);
    expect(getCreditBalance("user-1").balance).toBe(0);
  });

  it("refunds reserved credits when provider generation fails", () => {
    reserveCredits("user-1", TRY_ON_CREDIT_COST);
    refundCredits("user-1", TRY_ON_CREDIT_COST);

    expect(getCreditBalance("user-1").balance).toBe(INITIAL_FREE_CREDITS);
  });
});
