import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";

const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
const authUser = {
  uid: "closet-analyze-user",
  email: "closet-analyze@example.com",
  name: "Closet Analyze User",
  picture: null,
  provider: "google" as const
};

async function loadRouteWithCookies(cookieValues: Map<string, string>) {
  vi.resetModules();
  vi.doMock("next/headers", () => ({
    cookies: () => ({
      get: (name: string) => {
        const value = cookieValues.get(name);
        return value ? { value } : undefined;
      }
    })
  }));

  return import("@/app/api/closet/analyze/route");
}

async function buildAuthCookies() {
  const { issueSessionTokens } = await import("@/lib/auth/server");
  const { accessToken } = await issueSessionTokens(
    authUser,
    "closet-analyze-family",
    "closet-analyze-token"
  );

  return new Map([[SESSION_COOKIE_NAMES.access, accessToken]]);
}

function buildRequest(payload: unknown) {
  return new Request("http://127.0.0.1:3001/api/closet/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

describe("POST /api/closet/analyze", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    process.env.AUTH_JWT_SECRET = "closet-analyze-test-secret";
    process.env.CLOSET_ANALYSIS_PROVIDER = "mock";
  });

  it("requires a login session", async () => {
    const { POST } = await loadRouteWithCookies(new Map());
    const response = await POST(buildRequest({ image }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "missing_access_token" });
  });

  it("returns mock closet analysis draft", async () => {
    const { POST } = await loadRouteWithCookies(await buildAuthCookies());
    const response = await POST(buildRequest({ image }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      size: "",
      size_source: "unknown"
    });
    expect(body.category).toBeTruthy();
  });

  it("rejects missing image", async () => {
    const { POST } = await loadRouteWithCookies(await buildAuthCookies());
    const response = await POST(buildRequest({}));

    expect(response.status).toBe(400);
  });
});
