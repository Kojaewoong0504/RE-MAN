import "server-only";

import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { OnboardingResponseIssue } from "@/lib/agents/contracts";

type StorageFailureStage = "upload" | "delete" | "unknown";
type ProviderFailureType = "invalid_onboarding_response";
type RuntimeRoute = "feedback" | "daily" | "storage-dev";
type RuntimeCategory = "storage" | "provider";

type StorageRuntimeIncident = {
  timestamp: string;
  route: RuntimeRoute;
  category: "storage";
  stage: StorageFailureStage;
  signature_hash: string;
  message: string;
  user_id: string | null;
  remediation_hint: string;
};

type ProviderRuntimeIncident = {
  timestamp: string;
  route: RuntimeRoute;
  category: "provider";
  failure_type: ProviderFailureType;
  provider: string;
  signature_hash: string;
  message: string;
  user_id: string | null;
  remediation_hint: string;
  invalid_fields: string[];
  diagnostics: OnboardingResponseIssue[];
  raw_keys: string[];
  stabilized_keys: string[];
};

type RuntimeIncident = StorageRuntimeIncident | ProviderRuntimeIncident;

type StorageRuntimeLearnedFailure = {
  signature_hash: string;
  category: "storage";
  route: RuntimeRoute;
  stage: StorageFailureStage;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  remediation_hint: string;
  linked_doc: string;
  linked_rule: string;
  promotion_candidate: boolean;
};

type ProviderRuntimeLearnedFailure = {
  signature_hash: string;
  category: "provider";
  route: RuntimeRoute;
  failure_type: ProviderFailureType;
  provider: string;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  remediation_hint: string;
  linked_doc: string;
  linked_rule: string;
  promotion_candidate: boolean;
  invalid_fields: string[];
};

type RuntimeLearnedFailure =
  | StorageRuntimeLearnedFailure
  | ProviderRuntimeLearnedFailure;

export type RuntimePromotionCandidate = {
  signature_hash: string;
  category: RuntimeCategory;
  route: RuntimeRoute;
  failure_type?: ProviderFailureType;
  provider?: string;
  occurrence_count: number;
  invalid_fields: string[];
  linked_doc: string;
  linked_rule: string;
  remediation_hint: string;
  suggested_rule: string;
};

const REPORTS_DIR = join(process.cwd(), "harness", "reports");
const INCIDENTS_PATH = join(REPORTS_DIR, "runtime-incidents.json");
const LEARNED_PATH = join(REPORTS_DIR, "runtime-learned-failures.json");
const PROMOTION_CANDIDATES_PATH = join(REPORTS_DIR, "runtime-promotion-candidates.json");
const MAX_RUNTIME_INCIDENTS = 50;

function normalizeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown_runtime_failure";
}

function getStorageFailureStage(message: string): StorageFailureStage {
  if (message.startsWith("forced_supabase_upload_failure")) {
    return "upload";
  }
  if (message.startsWith("supabase_upload_failed:")) {
    return "upload";
  }
  if (message.startsWith("forced_supabase_delete_failure")) {
    return "delete";
  }
  if (message.startsWith("supabase_delete_failed:")) {
    return "delete";
  }
  return "unknown";
}

function getStorageRemediationHint(stage: StorageFailureStage) {
  if (stage === "upload") {
    return "Check Supabase bucket configuration, service-role credentials, and upload validation before retrying.";
  }
  if (stage === "delete") {
    return "Keep temporary image deletion in a finally path and verify bucket permissions allow server-side remove operations.";
  }
  return "Inspect the storage failure, keep fallback behavior intact, and route repeated failures into rule promotion.";
}

function getProviderRemediationHint(failureType: ProviderFailureType) {
  if (failureType === "invalid_onboarding_response") {
    return "Inspect provider diagnostics, stabilize unsupported enums/keys, and promote repeated contract drift into validation rules.";
  }

  return "Inspect provider diagnostics and promote repeated contract drift into validation rules.";
}

function buildSuggestedRuleForLearnedFailure(
  failure: RuntimeLearnedFailure
): string | null {
  if (failure.category === "provider" && failure.failure_type === "invalid_onboarding_response") {
    const invalidFields = failure.invalid_fields.length
      ? failure.invalid_fields.join(", ")
      : "unknown-fields";

    return [
      "Gemini onboarding provider drift must not reach route failure without stabilization.",
      `Repeated invalid fields: ${invalidFields}.`,
      "If the provider returns unsupported enum values or optional contract drift, stabilize them before validateOnboardingResponse and add a regression test."
    ].join(" ");
  }

  return null;
}

export function deriveRuntimePromotionCandidates(
  learnedFailures: Record<string, RuntimeLearnedFailure>
): RuntimePromotionCandidate[] {
  return Object.values(learnedFailures).flatMap((failure) => {
    if (!failure.promotion_candidate) {
      return [];
    }

      const suggestedRule = buildSuggestedRuleForLearnedFailure(failure);

      if (!suggestedRule) {
        return [];
      }

      return [{
        signature_hash: failure.signature_hash,
        category: failure.category,
        route: failure.route,
        failure_type: failure.category === "provider" ? failure.failure_type : undefined,
        provider: failure.category === "provider" ? failure.provider : undefined,
        occurrence_count: failure.occurrence_count,
        invalid_fields: failure.category === "provider" ? failure.invalid_fields : [],
        linked_doc: failure.linked_doc,
        linked_rule: failure.linked_rule,
        remediation_hint: failure.remediation_hint,
        suggested_rule: suggestedRule
      }];
    });
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, payload: unknown) {
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

export function isStorageFailureError(error: unknown) {
  const message = normalizeErrorMessage(error);
  return (
    message.startsWith("forced_supabase_upload_failure") ||
    message.startsWith("forced_supabase_delete_failure") ||
    message.startsWith("supabase_upload_failed:") ||
    message.startsWith("supabase_delete_failed:")
  );
}

export async function recordStorageRuntimeFailure(input: {
  route: RuntimeRoute;
  error: unknown;
  userId?: string;
}) {
  const message = normalizeErrorMessage(input.error);
  const stage = getStorageFailureStage(message);
  const remediationHint = getStorageRemediationHint(stage);
  const signatureHash = createHash("sha256")
    .update(`storage:${input.route}:${stage}:${message}`)
    .digest("hex")
    .slice(0, 16);
  const now = new Date().toISOString();

  const incidents = await readJson<RuntimeIncident[]>(INCIDENTS_PATH, []);
  const nextIncidents = [
    ...incidents,
    {
      timestamp: now,
      route: input.route,
      category: "storage",
      stage,
      signature_hash: signatureHash,
      message,
      user_id: input.userId ?? null,
      remediation_hint: remediationHint
    }
  ].slice(-MAX_RUNTIME_INCIDENTS);

  const learned = await readJson<Record<string, RuntimeLearnedFailure>>(LEARNED_PATH, {});
  const current = learned[signatureHash];
  const occurrenceCount = (current?.occurrence_count ?? 0) + 1;

  learned[signatureHash] = {
    signature_hash: signatureHash,
    category: "storage",
    route: input.route,
    stage,
    first_seen_at: current?.first_seen_at ?? now,
    last_seen_at: now,
    occurrence_count: occurrenceCount,
    remediation_hint: remediationHint,
    linked_doc: "docs/engineering/security.md",
    linked_rule: "supabase-temp-image-delete",
    promotion_candidate: occurrenceCount >= 2
  };

  const promotionCandidates = deriveRuntimePromotionCandidates(learned);

  await Promise.all([
    writeJson(INCIDENTS_PATH, nextIncidents),
    writeJson(LEARNED_PATH, learned),
    writeJson(PROMOTION_CANDIDATES_PATH, promotionCandidates)
  ]);
}

export async function recordProviderRuntimeFailure(input: {
  route: RuntimeRoute;
  provider: string;
  failureType: ProviderFailureType;
  error: unknown;
  userId?: string;
  diagnostics: OnboardingResponseIssue[];
  rawKeys: string[];
  stabilizedKeys: string[];
}) {
  const message = normalizeErrorMessage(input.error);
  const remediationHint = getProviderRemediationHint(input.failureType);
  const invalidFields = [...new Set(input.diagnostics.map((issue) => issue.field))].sort();
  const signatureHash = createHash("sha256")
    .update(
      JSON.stringify({
        category: "provider",
        route: input.route,
        provider: input.provider,
        failureType: input.failureType,
        invalidFields
      })
    )
    .digest("hex")
    .slice(0, 16);
  const now = new Date().toISOString();

  const incidents = await readJson<RuntimeIncident[]>(INCIDENTS_PATH, []);
  const nextIncidents = [
    ...incidents,
    {
      timestamp: now,
      route: input.route,
      category: "provider",
      failure_type: input.failureType,
      provider: input.provider,
      signature_hash: signatureHash,
      message,
      user_id: input.userId ?? null,
      remediation_hint: remediationHint,
      invalid_fields: invalidFields,
      diagnostics: input.diagnostics,
      raw_keys: [...new Set(input.rawKeys)].sort(),
      stabilized_keys: [...new Set(input.stabilizedKeys)].sort()
    }
  ].slice(-MAX_RUNTIME_INCIDENTS);

  const learned = await readJson<Record<string, RuntimeLearnedFailure>>(LEARNED_PATH, {});
  const current = learned[signatureHash];
  const occurrenceCount = (current?.occurrence_count ?? 0) + 1;

  learned[signatureHash] = {
    signature_hash: signatureHash,
    category: "provider",
    route: input.route,
    failure_type: input.failureType,
    provider: input.provider,
    first_seen_at: current?.first_seen_at ?? now,
    last_seen_at: now,
    occurrence_count: occurrenceCount,
    remediation_hint: remediationHint,
    linked_doc: "docs/engineering/verification-matrix.md",
    linked_rule: "provider-response-stabilization",
    promotion_candidate: occurrenceCount >= 2,
    invalid_fields: invalidFields
  };

  const promotionCandidates = deriveRuntimePromotionCandidates(learned);

  await Promise.all([
    writeJson(INCIDENTS_PATH, nextIncidents),
    writeJson(LEARNED_PATH, learned),
    writeJson(PROMOTION_CANDIDATES_PATH, promotionCandidates)
  ]);
}
