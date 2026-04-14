import { NextResponse } from "next/server";
import {
  FALLBACK_MESSAGE,
  validateDeepDiveRequest
} from "@/lib/agents/contracts";
import { buildMockDeepDiveFeedback } from "@/lib/agents/mock-feedback";
import {
  generateDeepDiveFeedback,
  resolveAiProvider
} from "@/lib/agents/gemini";
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

  if (!validateDeepDiveRequest(payload)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const feedback = await withTemporaryStoredImage(
      payload,
      async () =>
        resolveAiProvider() === "mock"
          ? buildMockDeepDiveFeedback(payload)
          : await generateDeepDiveFeedback(payload),
      getStorageFailureMode(request)
    );

    return NextResponse.json(feedback);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_deep_dive_error";

    console.error("[deep_dive_failed]", message);

    return NextResponse.json(
      {
        error: "deep_dive_failed",
        ...(process.env.NODE_ENV === "development" ? { detail: message } : {}),
        fallback_message: FALLBACK_MESSAGE
      },
      { status: 500 }
    );
  }
}
