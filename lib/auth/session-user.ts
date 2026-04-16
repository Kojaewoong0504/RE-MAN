import { cookies } from "next/headers";
import { getSessionCookieNames, serializeAuthUser, verifyAccessToken } from "@/lib/auth/server";

export async function getAuthenticatedSessionUser() {
  const cookieStore = cookies();
  const names = getSessionCookieNames();
  const accessToken = cookieStore.get(names.access)?.value;

  if (!accessToken) {
    throw new Error("missing_access_token");
  }

  try {
    const payload = await verifyAccessToken(accessToken);
    return serializeAuthUser(payload);
  } catch {
    throw new Error("invalid_access_token");
  }
}
