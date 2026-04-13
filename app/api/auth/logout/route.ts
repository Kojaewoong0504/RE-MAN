import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildClearedCookieOptions,
  getSessionCookieNames,
  revokeRefreshSessionFamily
} from "@/lib/auth/server";

export async function POST() {
  const names = getSessionCookieNames();
  const cookieStore = cookies();
  const sessionStateToken = cookieStore.get(names.state)?.value;

  if (sessionStateToken) {
    await revokeRefreshSessionFamily(sessionStateToken).catch(() => undefined);
  }

  cookieStore.set(names.access, "", buildClearedCookieOptions());
  cookieStore.set(names.refresh, "", buildClearedCookieOptions());
  cookieStore.set(names.state, "", buildClearedCookieOptions());

  return NextResponse.json({ ok: true });
}
