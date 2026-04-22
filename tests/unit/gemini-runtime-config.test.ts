import { describe, expect, it } from "vitest";
import { getGeminiRuntimeDefaultsForEnv } from "@/lib/agents/gemini";

describe("gemini runtime defaults", () => {
  it("uses a longer timeout budget in local development", () => {
    expect(getGeminiRuntimeDefaultsForEnv("development")).toEqual({
      timeoutMs: 45000,
      maxRetries: 0
    });
  });

  it("keeps tighter production defaults", () => {
    expect(getGeminiRuntimeDefaultsForEnv("production")).toEqual({
      timeoutMs: 8000,
      maxRetries: 2
    });
  });
});
