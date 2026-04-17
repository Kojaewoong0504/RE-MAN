import { NextResponse } from "next/server";
import {
  generateTryOnPreview,
  getTryOnRuntimeStatus,
  TryOnProviderError,
  validateTryOnRequest
} from "@/lib/agents/try-on";
import { getAuthenticatedSessionUser } from "@/lib/auth/session-user";
import {
  getCreditBalance,
  InsufficientCreditsError,
  refundCredits,
  reserveCredits,
  TRY_ON_CREDIT_COST
} from "@/lib/credits/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const TRY_ON_RATE_LIMIT = {
  limit: 3,
  windowMs: 60 * 1000
};
const TRY_ON_FALLBACK_MESSAGE =
  "실착 미리보기를 만들지 못했습니다. 레퍼런스 이미지를 먼저 확인하고 잠시 후 다시 시도해 주세요.";

function getTryOnErrorMessage(error: TryOnProviderError) {
  if (error.code === "missing_vertex_config") {
    return "실제 실착 생성 설정이 아직 준비되지 않았습니다. 지금은 레퍼런스 이미지를 확인해 주세요.";
  }

  return TRY_ON_FALLBACK_MESSAGE;
}

function getIdempotencyKey(request: Request) {
  const value = request.headers.get("Idempotency-Key")?.trim();

  if (!value) {
    return null;
  }

  return value.slice(0, 160);
}

export function GET() {
  return NextResponse.json(getTryOnRuntimeStatus());
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  if (!validateTryOnRequest(payload)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let reservedCredits = false;
  let userId: string | null = null;
  let creditReferenceId = crypto.randomUUID();
  const idempotencyKey = getIdempotencyKey(request);

  try {
    const user = await getAuthenticatedSessionUser();
    userId = user.uid;
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

    const runtimeStatus = getTryOnRuntimeStatus();

    if (runtimeStatus.real_generation_enabled) {
      const reservation = reserveCredits(user.uid, TRY_ON_CREDIT_COST, {
        reason: "try_on_generation",
        referenceId: creditReferenceId,
        idempotencyKey
      });
      reservedCredits = !reservation.idempotent_replay;
      creditReferenceId = reservation.replayed_reference_id ?? creditReferenceId;
    }

    const preview = await generateTryOnPreview({
      ...payload,
      user_id: user.uid
    });
    const credits = getCreditBalance(user.uid);

    return NextResponse.json(
      {
        ...preview,
        credits_remaining: credits.balance,
        credits_charged: reservedCredits ? TRY_ON_CREDIT_COST : 0,
        idempotent_replay: runtimeStatus.real_generation_enabled && !reservedCredits,
        credit_reference_id: runtimeStatus.real_generation_enabled ? creditReferenceId : null
      },
      {
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining)
        }
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("access_token")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          message: "실착 생성에 필요한 크레딧이 부족합니다. 충전 기능은 준비 중입니다.",
          credits_remaining: error.balance,
          credits_required: error.cost
        },
        { status: 402 }
      );
    }

    if (reservedCredits && userId) {
      refundCredits(userId, TRY_ON_CREDIT_COST, {
        reason: "try_on_failed_refund",
        referenceId: creditReferenceId,
        idempotencyKey
      });
    }

    if (error instanceof TryOnProviderError) {
      console.error("[try_on_failed]", {
        code: error.code,
        detail: error.message
      });

      return NextResponse.json(
        {
          error: error.code,
          message: getTryOnErrorMessage(error)
        },
        { status: error.statusHint }
      );
    }

    return NextResponse.json(
      {
        error: "try_on_failed",
        message: TRY_ON_FALLBACK_MESSAGE
      },
      { status: 500 }
    );
  }
}
