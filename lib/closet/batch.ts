import type { ClosetItem, ClosetItemCategory } from "@/lib/onboarding/storage";

export const CONFIDENCE_REVIEW_THRESHOLD = 0.7;

export type ClosetAnalysisStatus =
  | "pending"
  | "analyzing"
  | "needs_review"
  | "confirmed"
  | "failed";

export type ClosetSizeSource =
  | "manual"
  | "label_ocr"
  | "measurement_estimate"
  | "unknown";

export type ClosetItemDraft = {
  id: string;
  photo_data_url: string;
  analysis_status: ClosetAnalysisStatus;
  category?: ClosetItemCategory;
  name?: string;
  color?: string;
  detected_type?: string;
  fit?: string;
  season?: string;
  condition?: string;
  size?: string;
  analysis_confidence?: number;
  size_source?: ClosetSizeSource;
  size_confidence?: number;
  error_message?: string;
  deleted?: boolean;
};

const categories: ClosetItemCategory[] = ["tops", "bottoms", "shoes", "outerwear"];
const sizeSources: ClosetSizeSource[] = [
  "manual",
  "label_ocr",
  "measurement_estimate",
  "unknown"
];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCategory(value: unknown): ClosetItemCategory | undefined {
  return categories.includes(value as ClosetItemCategory)
    ? (value as ClosetItemCategory)
    : undefined;
}

function normalizeSizeSource(value: unknown): ClosetSizeSource {
  return sizeSources.includes(value as ClosetSizeSource)
    ? (value as ClosetSizeSource)
    : "unknown";
}

function normalizeConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

export function normalizeClosetDraft(input: Partial<ClosetItemDraft>): ClosetItemDraft {
  const confidence = normalizeConfidence(input.analysis_confidence);
  const sizeSource = normalizeSizeSource(input.size_source);
  const explicitStatus = input.analysis_status;
  const analysisStatus: ClosetAnalysisStatus =
    explicitStatus === "failed"
      ? "failed"
      : explicitStatus === "pending"
        ? "pending"
        : explicitStatus === "analyzing"
        ? confidence >= CONFIDENCE_REVIEW_THRESHOLD
          ? "confirmed"
          : "needs_review"
        : explicitStatus === "confirmed" && confidence < CONFIDENCE_REVIEW_THRESHOLD
          ? "needs_review"
          : explicitStatus ?? "needs_review";

  return {
    id: clean(input.id) || `draft-${Date.now()}`,
    photo_data_url: clean(input.photo_data_url),
    analysis_status: analysisStatus,
    category: normalizeCategory(input.category),
    name: clean(input.name),
    color: clean(input.color),
    detected_type: clean(input.detected_type),
    fit: clean(input.fit),
    season: clean(input.season),
    condition: clean(input.condition),
    size: clean(input.size),
    analysis_confidence: confidence,
    size_source: sizeSource,
    size_confidence: sizeSource === "unknown" ? 0 : normalizeConfidence(input.size_confidence),
    error_message: clean(input.error_message),
    deleted: Boolean(input.deleted)
  };
}

export function selectSaveableDrafts(drafts: ClosetItemDraft[]) {
  return drafts.filter(
    (draft) =>
      !draft.deleted &&
      draft.analysis_status === "confirmed" &&
      Boolean(draft.category) &&
      Boolean(draft.name?.trim())
  );
}

export function draftToClosetItem(draft: ClosetItemDraft): ClosetItem {
  const sizeSource = normalizeSizeSource(draft.size_source);

  return {
    id: `closet-${draft.id}`,
    category: draft.category ?? "tops",
    name: draft.name?.trim() || draft.detected_type?.trim() || "옷장 사진",
    photo_data_url: draft.photo_data_url,
    color: draft.color?.trim() ?? "",
    fit: draft.fit?.trim() ?? "",
    size: sizeSource === "unknown" ? "" : draft.size?.trim() ?? "",
    season: draft.season?.trim() ?? "",
    condition: draft.condition?.trim() ?? "",
    notes: draft.detected_type?.trim() ? `AI 초안: ${draft.detected_type.trim()}` : ""
  };
}
