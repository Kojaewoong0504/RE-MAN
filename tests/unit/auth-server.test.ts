import { describe, expect, it, vi } from "vitest";

describe("auth server token logic", () => {
  it("issues verifiable access, refresh, and session-state tokens", async () => {
    vi.resetModules();
    process.env.AUTH_JWT_SECRET = "unit-test-secret";

    const {
      issueSessionTokens,
      resetRefreshFamiliesForTests,
      serializeAuthUser,
      verifyAccessToken,
      verifyRefreshToken,
      verifySessionStateToken
    } = await import("@/lib/auth/server");

    await resetRefreshFamiliesForTests();

    const user = {
      uid: "user-1",
      email: "user@example.com",
      name: "User One",
      picture: null,
      provider: "google" as const
    };

    const tokens = await issueSessionTokens(user, "family-a", "token-a");
    const accessPayload = await verifyAccessToken(tokens.accessToken);
    const refreshPayload = await verifyRefreshToken(tokens.refreshToken);
    const statePayload = await verifySessionStateToken(tokens.sessionStateToken);

    expect(serializeAuthUser(accessPayload)).toEqual(user);
    expect(refreshPayload.familyId).toBe("family-a");
    expect(refreshPayload.tokenId).toBe("token-a");
    expect(statePayload.familyId).toBe("family-a");
    expect(statePayload.currentTokenId).toBe("token-a");
  });

  it("rejects tokens when the wrong verifier is used", async () => {
    vi.resetModules();
    process.env.AUTH_JWT_SECRET = "unit-test-secret";

    const {
      issueSessionTokens,
      resetRefreshFamiliesForTests,
      verifyAccessToken,
      verifyRefreshToken
    } = await import("@/lib/auth/server");

    await resetRefreshFamiliesForTests();

    const user = {
      uid: "user-2",
      email: "user2@example.com",
      name: "User Two",
      picture: null,
      provider: "google" as const
    };

    const tokens = await issueSessionTokens(user, "family-b", "token-b");

    await expect(verifyAccessToken(tokens.refreshToken)).rejects.toThrow(
      "invalid_access_token_type"
    );
    await expect(verifyRefreshToken(tokens.accessToken)).rejects.toThrow(
      "invalid_refresh_token_type"
    );
  });
});
