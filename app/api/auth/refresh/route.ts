import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildClearedCookieOptions,
  buildSessionCookieOptions,
  getAccessTokenTtl,
  getRefreshTokenTtl,
  getSessionCookieNames,
  rotateRefreshSession
} from "@/lib/auth/server";

export async function POST() {
  const cookieStore = cookies();
  const names = getSessionCookieNames();
  const refreshToken = cookieStore.get(names.refresh)?.value;
  const sessionStateToken = cookieStore.get(names.state)?.value;

  if (!refreshToken || !sessionStateToken) {
    return NextResponse.json({ error: "missing_refresh_state" }, { status: 401 });
  }

  try {
    const rotated = await rotateRefreshSession(refreshToken, sessionStateToken);

    cookieStore.set(names.access, rotated.accessToken, buildSessionCookieOptions(getAccessTokenTtl()));
    cookieStore.set(names.refresh, rotated.refreshToken, buildSessionCookieOptions(getRefreshTokenTtl()));
    cookieStore.set(names.state, rotated.sessionStateToken, buildSessionCookieOptions(getRefreshTokenTtl()));

    return NextResponse.json({ ok: true });
  } catch (error) {
    cookieStore.set(names.access, "", buildClearedCookieOptions());
    cookieStore.set(names.refresh, "", buildClearedCookieOptions());
    cookieStore.set(names.state, "", buildClearedCookieOptions());

    const message = error instanceof Error ? error.message : "refresh_failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
