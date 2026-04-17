import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";

describe("auth middleware", () => {
  it("redirects protected routes without session cookies", () => {
    const request = new NextRequest("http://127.0.0.1:3001/credits");
    const response = middleware(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).not.toBeNull();
    expect(new URL(location ?? "http://localhost").pathname).toBe("/login");
    expect(new URL(location ?? "http://localhost").searchParams.get("returnTo")).toBe(
      "/credits"
    );
  });

  it("redirects core style onboarding without session cookies", () => {
    const request = new NextRequest("http://127.0.0.1:3001/programs/style/onboarding/upload");
    const response = middleware(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).not.toBeNull();
    expect(new URL(location ?? "http://localhost").pathname).toBe("/login");
    expect(new URL(location ?? "http://localhost").searchParams.get("returnTo")).toBe(
      "/programs/style/onboarding/upload"
    );
  });

  it("allows core style onboarding when an access token is present", () => {
    const request = new NextRequest("http://127.0.0.1:3001/programs/style/onboarding/survey", {
      headers: {
        cookie: `${SESSION_COOKIE_NAMES.access}=access-token`
      }
    });
    const response = middleware(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows protected routes when an access token is present", () => {
    const request = new NextRequest("http://127.0.0.1:3001/closet", {
      headers: {
        cookie: `${SESSION_COOKIE_NAMES.access}=access-token`
      }
    });
    const response = middleware(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows protected routes when only a refresh token is present", () => {
    const request = new NextRequest("http://127.0.0.1:3001/profile", {
      headers: {
        cookie: `${SESSION_COOKIE_NAMES.refresh}=refresh-token`
      }
    });
    const response = middleware(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
