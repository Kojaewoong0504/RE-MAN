import { NextResponse } from "next/server";
import {
  FALLBACK_MESSAGE,
  validateAgentRequest,
  validateDailyResponse
} from "@/lib/agents/contracts";
import { buildMockDailyFeedback } from "@/lib/agents/mock-feedback";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  if (!validateAgentRequest(payload)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const feedback = buildMockDailyFeedback(payload);

    if (!validateDailyResponse(feedback)) {
      throw new Error("invalid_daily_response");
    }

    return NextResponse.json(feedback);
  } catch {
    return NextResponse.json(
      {
        error: "feedback_failed",
        fallback_message: FALLBACK_MESSAGE
      },
      { status: 500 }
    );
  }
}
