import { describe, expect, it, vi } from "vitest";
import { deriveRuntimePromotionCandidates } from "@/lib/harness/runtime-failures";

vi.mock("server-only", () => ({}));

describe("runtime promotion candidates", () => {
  it("promotes repeated provider drift learned failures into explicit rule candidates", () => {
    const candidates = deriveRuntimePromotionCandidates({
      abc123: {
        signature_hash: "abc123",
        category: "provider",
        route: "feedback",
        failure_type: "invalid_onboarding_response",
        provider: "gemini",
        first_seen_at: "2026-04-22T00:00:00.000Z",
        last_seen_at: "2026-04-22T00:10:00.000Z",
        occurrence_count: 2,
        remediation_hint:
          "Inspect provider diagnostics, stabilize unsupported enums/keys, and promote repeated contract drift into validation rules.",
        linked_doc: "docs/engineering/verification-matrix.md",
        linked_rule: "provider-response-stabilization",
        promotion_candidate: true,
        invalid_fields: ["recommendation_mix", "body_profile"]
      }
    });

    expect(candidates).toEqual([
      {
        signature_hash: "abc123",
        category: "provider",
        route: "feedback",
        failure_type: "invalid_onboarding_response",
        provider: "gemini",
        occurrence_count: 2,
        invalid_fields: ["recommendation_mix", "body_profile"],
        linked_doc: "docs/engineering/verification-matrix.md",
        linked_rule: "provider-response-stabilization",
        remediation_hint:
          "Inspect provider diagnostics, stabilize unsupported enums/keys, and promote repeated contract drift into validation rules.",
        suggested_rule: expect.stringContaining(
          "Gemini onboarding provider drift must not reach route failure without stabilization."
        )
      }
    ]);
  });

  it("does not create promotion candidates for non-provider learned failures", () => {
    const candidates = deriveRuntimePromotionCandidates({
      storage1: {
        signature_hash: "storage1",
        category: "storage",
        route: "feedback",
        stage: "upload",
        first_seen_at: "2026-04-22T00:00:00.000Z",
        last_seen_at: "2026-04-22T00:10:00.000Z",
        occurrence_count: 3,
        remediation_hint: "Check Supabase bucket configuration.",
        linked_doc: "docs/engineering/security.md",
        linked_rule: "supabase-temp-image-delete",
        promotion_candidate: true
      }
    });

    expect(candidates).toEqual([]);
  });
});
