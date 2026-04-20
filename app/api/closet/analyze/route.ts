import { NextResponse } from "next/server";
import { getAuthenticatedSessionUser } from "@/lib/auth/session-user";
import { analyzeClosetImage } from "@/lib/closet/analysis-provider";
import {
  CLOSET_ANALYSIS_CREDIT_COST,
  InsufficientCreditsError,
  refundCreditsAsync,
  reserveEntitledUsageAsync
} from "@/lib/credits/server";

export const maxDuration = 60;

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

  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { image?: unknown }).image !== "string" ||
    !(body as { image: string }).image.startsWith("data:image/")
  ) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }

  let chargedCredits = false;
  let creditReferenceId = crypto.randomUUID();
  const idempotencyKey = getIdempotencyKey(request);

  try {
    const entitlement = await reserveEntitledUsageAsync(user.uid, CLOSET_ANALYSIS_CREDIT_COST, {
      reason: "closet_analysis",
      referenceId: creditReferenceId,
      idempotencyKey
    });
    chargedCredits = entitlement.charged && !entitlement.credits.idempotent_replay;
    creditReferenceId = entitlement.credits.replayed_reference_id ?? creditReferenceId;

    const result = await analyzeClosetImage({ image: (body as { image: string }).image });
    return NextResponse.json({
      ...result,
      credits_charged:
        entitlement.charged && !entitlement.credits.idempotent_replay
          ? CLOSET_ANALYSIS_CREDIT_COST
          : 0,
      credits_remaining: entitlement.credits.balance,
      subscription_active: entitlement.credits.subscription_active,
      idempotent_replay: entitlement.credits.idempotent_replay,
      credit_reference_id: creditReferenceId
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          message: "옷장 AI 초안에 필요한 크레딧이 부족합니다.",
          credits_remaining: error.balance,
          credits_required: error.cost
        },
        { status: 402 }
      );
    }

    if (chargedCredits) {
      await refundCreditsAsync(user.uid, CLOSET_ANALYSIS_CREDIT_COST, {
        reason: "closet_analysis_failed_refund",
        referenceId: creditReferenceId,
        idempotencyKey
      });
    }

    const message = error instanceof Error ? error.message : "analysis_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
