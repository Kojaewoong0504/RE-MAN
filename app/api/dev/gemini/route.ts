import { NextResponse } from "next/server";
import {
  generateOnboardingFeedback,
  resolveAiProvider
} from "@/lib/agents/gemini";

export async function POST() {
  try {
    const provider = resolveAiProvider();
    const startedAt = Date.now();

    if (provider !== "gemini") {
      return NextResponse.json(
        {
          ok: false,
          error: "gemini_provider_not_enabled",
          provider
        },
        { status: 400 }
      );
    }

    const feedback = await generateOnboardingFeedback({
      text_description:
        "검은색 반팔 티셔츠와 연청 청바지를 입고 있고, 신발은 흰색 스니커즈입니다. 전체적으로 무난하지만 포인트가 없습니다.",
      survey: {
        current_style: "청바지 + 무지 티셔츠",
        motivation: "소개팅 / 이성 만남",
        budget: "15~30만원"
      },
      feedback_history: []
    }, {
      timeoutMs: 15000,
      maxRetries: 0,
      instructionMode: "smoke"
    });

    return NextResponse.json({
      ok: true,
      provider,
      duration_ms: Date.now() - startedAt,
      feedback
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_gemini_error";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        provider: resolveAiProvider()
      },
      { status: 500 }
    );
  }
}
