import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";

async function loadRouteWithCookieSpy() {
  vi.resetModules();
  const setCookie = vi.fn();

  vi.doMock("next/headers", () => ({
    cookies: () => ({
      set: setCookie
    })
  }));

  const route = await import("@/app/api/auth/dev-login/route");
  return { route, setCookie };
}

describe("dev login API route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AUTH_JWT_SECRET = "dev-login-test-secret";
  });

  it("issues local-only development session cookies", async () => {
    const { route, setCookie } = await loadRouteWithCookieSpy();

    const response = await route.POST(
      new Request("http://127.0.0.1:3001/api/auth/dev-login")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({
      uid: "local-dev-user",
      email: "local-dev@re-men.test",
      provider: "google"
    });
    expect(setCookie).toHaveBeenCalledTimes(3);
    expect(setCookie.mock.calls.map((call) => call[0])).toEqual([
      SESSION_COOKIE_NAMES.access,
      SESSION_COOKIE_NAMES.refresh,
      SESSION_COOKIE_NAMES.state
    ]);
  });

  it("rejects non-localhost callers", async () => {
    const { route, setCookie } = await loadRouteWithCookieSpy();

    const response = await route.POST(
      new Request("https://example.com/api/auth/dev-login")
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ error: "dev_login_forbidden" });
    expect(setCookie).not.toHaveBeenCalled();
  });
});
