import { NextResponse } from "next/server";
import {
  FALLBACK_MESSAGE,
  validateAgentRequest
} from "@/lib/agents/contracts";
import {
  generateOnboardingFeedback,
  resolveAiProvider
} from "@/lib/agents/gemini";
import {
  isStorageFailureError,
  recordStorageRuntimeFailure
} from "@/lib/harness/runtime-failures";
import { buildMockOnboardingFeedback } from "@/lib/agents/mock-feedback";
import {
  type StorageFailureMode,
  withTemporaryStoredImage
} from "@/lib/supabase/temp-image";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getAuthenticatedSessionUser } from "@/lib/auth/session-user";
import {
  InsufficientCreditsError,
  refundCredits,
  reserveEntitledUsage,
  STYLE_FEEDBACK_CREDIT_COST
} from "@/lib/credits/server";

const FEEDBACK_RATE_LIMIT = {
  limit: 5,
  windowMs: 60 * 1000
};

function getStorageFailureMode(request: Request): StorageFailureMode {
  const value = request.headers.get("x-harness-storage-failure-mode");
  return value === "upload" || value === "delete" ? value : "none";
}

function getFeedbackRateLimitKey(userId: string) {
  return `feedback:user:${userId}`;
}

function getIdempotencyKey(request: Request) {
  const value = request.headers.get("Idempotency-Key")?.trim();

  if (!value) {
    return null;
  }

  return value.slice(0, 160);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedSessionUser().catch((error) => {
    if (error instanceof Error && error.message.endsWith("access_token")) {
      return null;
    }

    throw error;
  });

  if (!user) {
    return NextResponse.json({ error: "missing_access_token" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);

  if (!validateAgentRequest(payload)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const rateLimit = checkRateLimit(
    getFeedbackRateLimitKey(user.uid),
    FEEDBACK_RATE_LIMIT
  );

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

  let chargedCredits = false;
  let creditReferenceId = crypto.randomUUID();
  const idempotencyKey = getIdempotencyKey(request);

  try {
    const entitlement = reserveEntitledUsage(user.uid, STYLE_FEEDBACK_CREDIT_COST, {
      reason: "style_feedback",
      referenceId: creditReferenceId,
      idempotencyKey
    });
    chargedCredits = entitlement.charged && !entitlement.credits.idempotent_replay;
    creditReferenceId = entitlement.credits.replayed_reference_id ?? creditReferenceId;

    const feedback = await withTemporaryStoredImage(
      {
        ...payload,
        user_id: user.uid
      },
      async () =>
        resolveAiProvider() === "mock"
          ? buildMockOnboardingFeedback({
              ...payload,
              user_id: user.uid
            })
          : await generateOnboardingFeedback({
              ...payload,
              user_id: user.uid
            }),
      getStorageFailureMode(request)
    );

    return NextResponse.json(
      {
        ...feedback,
        credits_charged:
          entitlement.charged && !entitlement.credits.idempotent_replay
            ? STYLE_FEEDBACK_CREDIT_COST
            : 0,
        credits_remaining: entitlement.credits.balance,
        subscription_active: entitlement.credits.subscription_active,
        idempotent_replay: entitlement.credits.idempotent_replay,
        credit_reference_id: creditReferenceId
      },
      {
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining)
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_feedback_error";

    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          message: "스타일 체크에 필요한 크레딧이 부족합니다.",
          credits_remaining: error.balance,
          credits_required: error.cost
        },
        { status: 402 }
      );
    }

    if (chargedCredits) {
      refundCredits(user.uid, STYLE_FEEDBACK_CREDIT_COST, {
        reason: "style_feedback_failed_refund",
        referenceId: creditReferenceId,
        idempotencyKey
      });
    }

    console.error("[feedback_failed]", message);

    if (isStorageFailureError(error)) {
      await recordStorageRuntimeFailure({
        route: "feedback",
        error,
        userId: user.uid
      });
    }

    return NextResponse.json(
      {
        error: "feedback_failed",
        ...(process.env.NODE_ENV === "development" ? { detail: message } : {}),
        fallback_message: FALLBACK_MESSAGE
      },
      { status: 500 }
    );
  }
}
