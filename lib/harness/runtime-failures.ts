import "server-only";

import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

type StorageFailureStage = "upload" | "delete" | "unknown";

type RuntimeIncident = {
  timestamp: string;
  route: "feedback" | "daily" | "storage-dev";
  category: "storage";
  stage: StorageFailureStage;
  signature_hash: string;
  message: string;
  user_id: string | null;
  remediation_hint: string;
};

type RuntimeLearnedFailure = {
  signature_hash: string;
  category: "storage";
  route: "feedback" | "daily" | "storage-dev";
  stage: StorageFailureStage;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  remediation_hint: string;
  linked_doc: string;
  linked_rule: string;
  promotion_candidate: boolean;
};

const REPORTS_DIR = join(process.cwd(), "harness", "reports");
const INCIDENTS_PATH = join(REPORTS_DIR, "runtime-incidents.json");
const LEARNED_PATH = join(REPORTS_DIR, "runtime-learned-failures.json");
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
  route: "feedback" | "daily" | "storage-dev";
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

  await Promise.all([
    writeJson(INCIDENTS_PATH, nextIncidents),
    writeJson(LEARNED_PATH, learned)
  ]);
}
