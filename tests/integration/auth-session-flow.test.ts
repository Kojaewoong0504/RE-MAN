import { describe, expect, it, vi } from "vitest";

describe("auth session flow", () => {
  it("rotates refresh sessions and preserves the token family", async () => {
    vi.resetModules();
    process.env.AUTH_JWT_SECRET = "integration-test-secret";

    const {
      issueSessionTokens,
      resetRefreshFamiliesForTests,
      rotateRefreshSession,
      verifyRefreshToken,
      verifySessionStateToken
    } = await import("@/lib/auth/server");

    await resetRefreshFamiliesForTests();

    const user = {
      uid: "user-3",
      email: "user3@example.com",
      name: "User Three",
      picture: null,
      provider: "google" as const
    };

    const initial = await issueSessionTokens(user, "family-c", "token-c");
    const rotated = await rotateRefreshSession(
      initial.refreshToken,
      initial.sessionStateToken
    );

    const initialRefresh = await verifyRefreshToken(initial.refreshToken);
    const rotatedRefresh = await verifyRefreshToken(rotated.refreshToken);
    const rotatedState = await verifySessionStateToken(rotated.sessionStateToken);

    expect(rotatedRefresh.familyId).toBe(initialRefresh.familyId);
    expect(rotatedRefresh.tokenId).not.toBe(initialRefresh.tokenId);
    expect(rotatedState.currentTokenId).toBe(rotatedRefresh.tokenId);
  });

  it("rejects refresh requests when refresh and state cookies do not match", async () => {
    vi.resetModules();
    process.env.AUTH_JWT_SECRET = "integration-test-secret";

    const {
      issueSessionTokens,
      resetRefreshFamiliesForTests,
      rotateRefreshSession
    } = await import("@/lib/auth/server");

    await resetRefreshFamiliesForTests();

    const user = {
      uid: "user-4",
      email: "user4@example.com",
      name: "User Four",
      picture: null,
      provider: "google" as const
    };

    const initial = await issueSessionTokens(user, "family-d", "token-d");
    const rotated = await rotateRefreshSession(
      initial.refreshToken,
      initial.sessionStateToken
    );

    await expect(
      rotateRefreshSession(initial.refreshToken, rotated.sessionStateToken)
    ).rejects.toThrow("refresh_token_reuse_detected");
  });

  it("rejects replay of an old refresh-token pair after rotation", async () => {
    vi.resetModules();
    process.env.AUTH_JWT_SECRET = "integration-test-secret";

    const {
      issueSessionTokens,
      resetRefreshFamiliesForTests,
      rotateRefreshSession
    } = await import("@/lib/auth/server");

    await resetRefreshFamiliesForTests();

    const user = {
      uid: "user-5",
      email: "user5@example.com",
      name: "User Five",
      picture: null,
      provider: "google" as const
    };

    const initial = await issueSessionTokens(user, "family-e", "token-e");
    await rotateRefreshSession(initial.refreshToken, initial.sessionStateToken);

    await expect(
      rotateRefreshSession(initial.refreshToken, initial.sessionStateToken)
    ).rejects.toThrow("refresh_token_reuse_detected");
  });
});
