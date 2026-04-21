import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";

vi.mock("server-only", () => ({}));

type CookieMap = Map<string, string>;

async function loadBootstrapRouteWithCookies(cookieValues: CookieMap) {
  vi.resetModules();
  const setCalls: Array<{ name: string; value: string }> = [];

  vi.doMock("next/headers", () => ({
    cookies: () => ({
      get: (name: string) => {
        const value = cookieValues.get(name);
        return value ? { value } : undefined;
      },
      set: (name: string, value: string) => {
        cookieValues.set(name, value);
        setCalls.push({ name, value });
      }
    })
  }));

  return {
    setCalls,
    route: await import("@/app/api/auth/bootstrap/route")
  };
}

describe("auth bootstrap route", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.AUTH_JWT_SECRET = "auth-bootstrap-test-secret";
    const { resetRefreshFamiliesForTests } = await import("@/lib/auth/server");
    await resetRefreshFamiliesForTests();
  });

  it("returns the current user from a valid access token", async () => {
    const { issueSessionTokens } = await import("@/lib/auth/server");
    const user = {
      uid: "bootstrap-user-1",
      email: "bootstrap-1@example.com",
      name: "Bootstrap User",
      picture: null,
      provider: "google" as const
    };
    const tokens = await issueSessionTokens(user, "bootstrap-family-1", "bootstrap-token-1");
    const cookieValues = new Map([[SESSION_COOKIE_NAMES.access, tokens.accessToken]]);
    const { route, setCalls } = await loadBootstrapRouteWithCookies(cookieValues);
    const response = await route.GET(new Request("http://127.0.0.1:3001/api/auth/bootstrap"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      user
    });
    expect(setCalls).toHaveLength(0);
  });

  it("rotates the refresh token family when only refresh credentials are available", async () => {
    const { issueSessionTokens } = await import("@/lib/auth/server");
    const user = {
      uid: "bootstrap-user-2",
      email: "bootstrap-2@example.com",
      name: "Bootstrap User Two",
      picture: null,
      provider: "google" as const
    };
    const tokens = await issueSessionTokens(user, "bootstrap-family-2", "bootstrap-token-2");
    const cookieValues = new Map([
      [SESSION_COOKIE_NAMES.refresh, tokens.refreshToken],
      [SESSION_COOKIE_NAMES.state, tokens.sessionStateToken]
    ]);
    const { route, setCalls } = await loadBootstrapRouteWithCookies(cookieValues);
    const response = await route.GET(new Request("http://127.0.0.1:3001/api/auth/bootstrap"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      user,
      refreshed: true
    });
    expect(setCalls.map((call) => call.name)).toEqual(
      expect.arrayContaining([
        SESSION_COOKIE_NAMES.access,
        SESSION_COOKIE_NAMES.refresh,
        SESSION_COOKIE_NAMES.state
      ])
    );
  });

  it("can include credits in the bootstrap response", async () => {
    const { issueSessionTokens } = await import("@/lib/auth/server");
    const user = {
      uid: "bootstrap-user-3",
      email: "bootstrap-3@example.com",
      name: "Bootstrap User Three",
      picture: null,
      provider: "google" as const
    };
    const tokens = await issueSessionTokens(user, "bootstrap-family-3", "bootstrap-token-3");
    const cookieValues = new Map([[SESSION_COOKIE_NAMES.access, tokens.accessToken]]);
    const { route } = await loadBootstrapRouteWithCookies(cookieValues);
    const response = await route.GET(
      new Request("http://127.0.0.1:3001/api/auth/bootstrap?include=credits")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.credits).toMatchObject({
      balance: 3,
      event_credits: 3,
      paid_credits: 0,
      subscription_active: false
    });
  });
});
