import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildSessionCookieOptions,
  getAccessTokenTtl,
  getRefreshTokenTtl,
  getSessionCookieNames,
  resolveSessionFromCookieValues
} from "@/lib/auth/server";
import { getCreditBalanceAsync } from "@/lib/credits/server";

export async function GET(request: Request) {
  const cookieStore = cookies();
  const names = getSessionCookieNames();
  const url = new URL(request.url);
  const includeCredits = url.searchParams.get("include") === "credits";

  try {
    const resolved = await resolveSessionFromCookieValues({
      accessToken: cookieStore.get(names.access)?.value,
      refreshToken: cookieStore.get(names.refresh)?.value,
      sessionStateToken: cookieStore.get(names.state)?.value
    });

    if (resolved.rotated) {
      cookieStore.set(
        names.access,
        resolved.rotated.accessToken,
        buildSessionCookieOptions(getAccessTokenTtl())
      );
      cookieStore.set(
        names.refresh,
        resolved.rotated.refreshToken,
        buildSessionCookieOptions(getRefreshTokenTtl())
      );
      cookieStore.set(
        names.state,
        resolved.rotated.sessionStateToken,
        buildSessionCookieOptions(getRefreshTokenTtl())
      );
    }

    return NextResponse.json({
      user: resolved.user,
      refreshed: Boolean(resolved.rotated),
      ...(includeCredits
        ? {
            credits: await getCreditBalanceAsync(resolved.user.uid)
          }
        : {})
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_bootstrap_failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
