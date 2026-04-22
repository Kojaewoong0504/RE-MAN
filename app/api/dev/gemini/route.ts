import { NextResponse } from "next/server";
import {
  debugGenerateOnboardingFeedback,
  generateOnboardingFeedback,
  resolveAiProvider
} from "@/lib/agents/gemini";

export const maxDuration = 60;

const defaultPostPayload = {
  text_description:
    "검은색 반팔 티셔츠와 연청 청바지를 입고 있고, 신발은 흰색 스니커즈입니다. 전체적으로 무난하지만 포인트가 없습니다.",
  survey: {
    current_style: "청바지 + 무지 티셔츠",
    motivation: "소개팅 / 이성 만남",
    budget: "15~30만원"
  },
  feedback_history: []
};

export async function POST(request: Request) {
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

    const body = (await request.json().catch(() => null)) as
      | {
          payload?: Parameters<typeof generateOnboardingFeedback>[0];
          debug?: boolean;
        }
      | null;
    const payload = body?.payload ?? defaultPostPayload;
    const options = {
      timeoutMs: Number(process.env.GEMINI_REQUEST_TIMEOUT_MS ?? 60000),
      maxRetries: 0,
      instructionMode: "smoke" as const
    };

    if (body?.debug) {
      const result = await debugGenerateOnboardingFeedback(payload, options);

      return NextResponse.json({
        ok: result.valid,
        provider,
        duration_ms: Date.now() - startedAt,
        valid: result.valid,
        normalized: result.normalized,
        stabilized: result.stabilized,
        raw: result.raw
      });
    }

    const feedback = await generateOnboardingFeedback(payload, options);

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

export async function GET() {
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

    const result = await debugGenerateOnboardingFeedback(
      {
        text_description:
          "상체가 먼저 보이고 흰 티셔츠와 어두운 하의 대비가 큰 전신 사진입니다. 지금은 기본 조합이지만 더 정돈된 방향을 원합니다.",
        survey: {
          current_style: "흰 티셔츠 + 어두운 하의",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "덩치가 덜 부각되는 정리된 인상",
          confidence_level: "배우는 중"
        },
        feedback_history: []
      },
      {
        timeoutMs: Number(process.env.GEMINI_REQUEST_TIMEOUT_MS ?? 60000),
        maxRetries: 0,
        instructionMode: "smoke"
      }
    );

    return NextResponse.json({
      ok: result.valid,
      provider,
      duration_ms: Date.now() - startedAt,
      valid: result.valid,
      normalized: result.normalized,
      stabilized: result.stabilized,
      raw: result.raw
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
