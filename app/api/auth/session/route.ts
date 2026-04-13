import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionCookieNames, serializeAuthUser, verifyAccessToken } from "@/lib/auth/server";

export async function GET() {
  try {
    const cookieStore = cookies();
    const names = getSessionCookieNames();
    const accessToken = cookieStore.get(names.access)?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "missing_access_token" }, { status: 401 });
    }

    const payload = await verifyAccessToken(accessToken);
    return NextResponse.json({ user: serializeAuthUser(payload) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_access_token";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
