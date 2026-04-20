import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";

const authUser = {
  uid: "closet-items-user",
  email: "closet-items@example.com",
  name: "Closet Items User",
  picture: null,
  provider: "google" as const
};

async function buildAuthCookies() {
  const { issueSessionTokens } = await import("@/lib/auth/server");
  const { accessToken } = await issueSessionTokens(
    authUser,
    "closet-items-family",
    "closet-items-token"
  );

  return new Map([[SESSION_COOKIE_NAMES.access, accessToken]]);
}

async function loadRouteWithCookies(cookieValues: Map<string, string>) {
  vi.resetModules();
  const persistClosetItemsForUser = vi.fn(async (input) => ({
    closet_items: input.items.map((item: Record<string, unknown>) => ({
      ...item,
      photo_data_url: "",
      image_url: "https://storage.example.com/closet/top.jpg",
      storage_bucket: "uploads",
      storage_path: "closet-items-user/top.jpg"
    })),
    closet_profile: input.closetProfile
  }));

  vi.doMock("next/headers", () => ({
    cookies: () => ({
      get: (name: string) => {
        const value = cookieValues.get(name);
        return value ? { value } : undefined;
      }
    })
  }));
  vi.doMock("@/lib/closet/server-persistence", () => ({
    persistClosetItemsForUser
  }));

  const route = await import("@/app/api/closet/items/route");
  return { ...route, persistClosetItemsForUser };
}

function buildRequest(payload: unknown) {
  return new Request("http://127.0.0.1:3001/api/closet/items", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

describe("PUT /api/closet/items", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    process.env.AUTH_JWT_SECRET = "closet-items-test-secret";
  });

  it("requires a login session", async () => {
    const { PUT } = await loadRouteWithCookies(new Map());
    const response = await PUT(buildRequest({ items: [] }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "missing_access_token" });
  });

  it("persists normalized closet items for the authenticated user", async () => {
    const { PUT, persistClosetItemsForUser } = await loadRouteWithCookies(await buildAuthCookies());
    const response = await PUT(
      buildRequest({
        items: [
          {
            id: "top-1",
            category: "tops",
            name: "옥스포드 셔츠",
            photo_data_url: "data:image/jpeg;base64,abc",
            color: "하늘색"
          }
        ],
        closet_profile: {
          avoid: "너무 큰 후드티"
        },
        size_profile: {
          top_size: "L"
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      closet_items: [
        {
          id: "top-1",
          category: "tops",
          name: "옥스포드 셔츠",
          photo_data_url: "",
          image_url: "https://storage.example.com/closet/top.jpg"
        }
      ],
      closet_profile: {
        avoid: "너무 큰 후드티"
      }
    });
    expect(persistClosetItemsForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "closet-items-user",
        email: "closet-items@example.com",
        items: [
          expect.objectContaining({
            id: "top-1",
            category: "tops",
            name: "옥스포드 셔츠"
          })
        ]
      })
    );
  });
});
