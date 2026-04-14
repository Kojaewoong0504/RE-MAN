import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionCookieNames, serializeAuthUser, verifyAccessToken } from "@/lib/auth/server";
import {
  generateTryOnPreview,
  getTryOnRuntimeStatus,
  validateTryOnRequest
} from "@/lib/agents/try-on";
import { checkRateLimit } from "@/lib/security/rate-limit";

const TRY_ON_RATE_LIMIT = {
  limit: 3,
  windowMs: 60 * 1000
};

export function GET() {
  return NextResponse.json(getTryOnRuntimeStatus());
}

async function getAuthenticatedUser() {
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

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  if (!validateTryOnRequest(payload)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const user = await getAuthenticatedUser();
    const rateLimit = checkRateLimit(`try-on:${user.uid}`, TRY_ON_RATE_LIMIT);

    if (!rateLimit.ok) {
      return NextResponse.json(
        {
          error: "rate_limited",
          reset_at: rateLimit.resetAt
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
          }
        }
      );
    }

    const preview = await generateTryOnPreview({
      ...payload,
      user_id: user.uid
    });

    return NextResponse.json(preview, {
      headers: {
        "X-RateLimit-Remaining": String(rateLimit.remaining)
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("access_token")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: "try_on_failed",
        message:
          error instanceof Error ? error.message : "unknown_try_on_error"
      },
      { status: 501 }
    );
  }
}
