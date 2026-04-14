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

function getStorageFailureMode(request: Request): StorageFailureMode {
  const value = request.headers.get("x-harness-storage-failure-mode");
  return value === "upload" || value === "delete" ? value : "none";
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  if (!validateAgentRequest(payload)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const feedback = await withTemporaryStoredImage(
      payload,
      async () =>
        resolveAiProvider() === "mock"
          ? buildMockOnboardingFeedback(payload)
          : await generateOnboardingFeedback(payload),
      getStorageFailureMode(request)
    );

    return NextResponse.json(feedback);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_feedback_error";

    console.error("[feedback_failed]", message);

    if (isStorageFailureError(error)) {
      await recordStorageRuntimeFailure({
        route: "feedback",
        error,
        userId: payload.user_id
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
