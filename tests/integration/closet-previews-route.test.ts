import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";

const authUser = {
  uid: "closet-preview-user",
  email: "closet-preview@example.com",
  name: "Closet Preview User",
  picture: null,
  provider: "google" as const
};

async function buildAuthCookies() {
  const { issueSessionTokens } = await import("@/lib/auth/server");
  const { accessToken } = await issueSessionTokens(
    authUser,
    "closet-preview-family",
    "closet-preview-token"
  );

  return new Map([[SESSION_COOKIE_NAMES.access, accessToken]]);
}

async function loadRouteWithCookies(cookieValues: Map<string, string>) {
  vi.resetModules();
  const createSignedImageUrl = vi.fn(async () => "https://signed.example.com/item-1.jpg");

  vi.doMock("next/headers", () => ({
    cookies: () => ({
      get: (name: string) => {
        const value = cookieValues.get(name);
        return value ? { value } : undefined;
      }
    })
  }));
  vi.doMock("@/lib/supabase/storage", () => ({
    hasSupabaseStorageConfig: () => true,
    createSignedImageUrl
  }));

  const route = await import("@/app/api/closet/previews/route");
  return { ...route, createSignedImageUrl };
}

function buildRequest(payload: unknown) {
  return new Request("http://127.0.0.1:3001/api/closet/previews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

describe("POST /api/closet/previews", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    process.env.AUTH_JWT_SECRET = "closet-preview-test-secret";
  });

  it("requires a login session", async () => {
    const { POST } = await loadRouteWithCookies(new Map());
    const response = await POST(buildRequest({ items: [] }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "missing_access_token" });
  });

  it("returns signed preview URLs for persisted closet items", async () => {
    const { POST, createSignedImageUrl } = await loadRouteWithCookies(await buildAuthCookies());
    const response = await POST(
      buildRequest({
        items: [
          {
            id: "top-1",
            category: "tops",
            name: "옥스포드 셔츠",
            storage_bucket: "uploads",
            storage_path: "closet/top-1.jpg"
          }
        ]
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      previews: [
        {
          id: "top-1",
          preview_url: "https://signed.example.com/item-1.jpg"
        }
      ]
    });
    expect(createSignedImageUrl).toHaveBeenCalledWith({
      bucket: "uploads",
      path: "closet/top-1.jpg"
    });
  });
});
