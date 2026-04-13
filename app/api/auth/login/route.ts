import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildSessionCookieOptions,
  getAccessTokenTtl,
  getRefreshTokenTtl,
  getSessionCookieNames,
  issueSessionTokens,
  verifyFirebaseIdToken
} from "@/lib/auth/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: string };

    if (!body.idToken) {
      return NextResponse.json({ error: "missing_id_token" }, { status: 400 });
    }

    const user = await verifyFirebaseIdToken(body.idToken);
    const { accessToken, refreshToken, sessionStateToken } = await issueSessionTokens(user);
    const cookieStore = cookies();
    const names = getSessionCookieNames();

    cookieStore.set(names.access, accessToken, buildSessionCookieOptions(getAccessTokenTtl()));
    cookieStore.set(names.refresh, refreshToken, buildSessionCookieOptions(getRefreshTokenTtl()));
    cookieStore.set(names.state, sessionStateToken, buildSessionCookieOptions(getRefreshTokenTtl()));

    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "login_failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
