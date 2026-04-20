import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildSessionCookieOptions,
  getAccessTokenTtl,
  getRefreshTokenTtl,
  getSessionCookieNames,
  issueSessionTokens
} from "@/lib/auth/server";
import type { AuthUser } from "@/lib/auth/types";

const localHosts = new Set(["localhost", "127.0.0.1"]);

function isDevLoginAllowed(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return localHosts.has(new URL(request.url).hostname);
}

export async function POST(request: Request) {
  if (!isDevLoginAllowed(request)) {
    return NextResponse.json({ error: "dev_login_forbidden" }, { status: 403 });
  }

  const user: AuthUser = {
    uid: "local-dev-user",
    email: "local-dev@re-men.test",
    name: "RE:MAN Local Dev",
    picture: null,
    provider: "google"
  };
  const { accessToken, refreshToken, sessionStateToken } = await issueSessionTokens(user);
  const cookieStore = cookies();
  const names = getSessionCookieNames();

  cookieStore.set(names.access, accessToken, buildSessionCookieOptions(getAccessTokenTtl()));
  cookieStore.set(names.refresh, refreshToken, buildSessionCookieOptions(getRefreshTokenTtl()));
  cookieStore.set(names.state, sessionStateToken, buildSessionCookieOptions(getRefreshTokenTtl()));

  return NextResponse.json({ user });
}
