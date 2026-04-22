import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_REVIEW_THRESHOLD,
  draftToClosetItem,
  getClosetDraftAnalysisIdempotencyKey,
  getClosetBatchSessionIdempotencyKey,
  getClosetBatchSummary,
  normalizeClosetDraft,
  selectAnalyzableDrafts,
  selectSaveableDrafts
} from "@/lib/closet/batch";

const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

describe("closet batch drafts", () => {
  it("keeps initial pending drafts pending before analysis", () => {
    const draft = normalizeClosetDraft({
      id: "draft-0",
      photo_data_url: photo,
      analysis_status: "pending"
    });

    expect(draft.analysis_status).toBe("pending");
  });

  it("keeps low confidence drafts in needs_review", () => {
    const draft = normalizeClosetDraft({
      id: "draft-1",
      photo_data_url: photo,
      analysis_status: "analyzing",
      category: "tops",
      name: "네이비 셔츠",
      analysis_confidence: CONFIDENCE_REVIEW_THRESHOLD - 0.01
    });

    expect(draft.analysis_status).toBe("needs_review");
  });

  it("converts confirmed draft to ClosetItem without trusting unknown size", () => {
    const item = draftToClosetItem({
      id: "draft-1",
      photo_data_url: photo,
      analysis_status: "confirmed",
      category: "tops",
      name: "네이비 셔츠",
      color: "네이비",
      detected_type: "셔츠",
      fit: "레귤러",
      season: "봄/가을",
      condition: "깨끗함",
      size: "L",
      size_source: "unknown",
      size_confidence: 0
    });

    expect(item).toMatchObject({
      category: "tops",
      name: "네이비 셔츠",
      color: "네이비",
      fit: "레귤러",
      season: "봄/가을",
      condition: "깨끗함",
      size: ""
    });
  });

  it("excludes failed and deleted drafts from saveable drafts", () => {
    const drafts = selectSaveableDrafts([
      {
        id: "draft-1",
        photo_data_url: photo,
        analysis_status: "confirmed",
        category: "tops",
        name: "흰 티셔츠"
      },
      {
        id: "draft-2",
        photo_data_url: photo,
        analysis_status: "failed",
        category: "bottoms",
        name: "청바지"
      },
      {
        id: "draft-3",
        photo_data_url: photo,
        analysis_status: "confirmed",
        deleted: true,
        category: "shoes",
        name: "스니커즈"
      }
    ]);

    expect(drafts.map((draft) => draft.id)).toEqual(["draft-1"]);
  });

  it("only analyzes pending or failed drafts and skips reviewed drafts", () => {
    const drafts = selectAnalyzableDrafts([
      {
        id: "draft-pending",
        photo_data_url: photo,
        analysis_status: "pending"
      },
      {
        id: "draft-failed",
        photo_data_url: photo,
        analysis_status: "failed"
      },
      {
        id: "draft-review",
        photo_data_url: photo,
        analysis_status: "needs_review",
        category: "tops",
        name: "셔츠"
      },
      {
        id: "draft-confirmed",
        photo_data_url: photo,
        analysis_status: "confirmed",
        category: "shoes",
        name: "스니커즈"
      }
    ]);

    expect(drafts.map((draft) => draft.id)).toEqual(["draft-pending", "draft-failed"]);
  });

  it("builds stable idempotency keys per draft", () => {
    expect(getClosetDraftAnalysisIdempotencyKey("draft-1")).toBe(
      "closet-analyze:draft-1"
    );
    expect(getClosetDraftAnalysisIdempotencyKey("  draft with spaces  ")).toBe(
      "closet-analyze:draft-with-spaces"
    );
  });

  it("builds stable idempotency keys per batch session", () => {
    expect(getClosetBatchSessionIdempotencyKey("batch-1")).toBe(
      "closet-analyze:batch-1"
    );
    expect(getClosetBatchSessionIdempotencyKey("  batch with spaces  ")).toBe(
      "closet-analyze:batch-with-spaces"
    );
  });

  it("summarizes batch registration progress for fast review", () => {
    const summary = getClosetBatchSummary([
      {
        id: "draft-pending",
        photo_data_url: photo,
        analysis_status: "pending"
      },
      {
        id: "draft-review",
        photo_data_url: photo,
        analysis_status: "needs_review",
        category: "tops",
        name: "셔츠"
      },
      {
        id: "draft-confirmed",
        photo_data_url: photo,
        analysis_status: "confirmed",
        category: "shoes",
        name: "스니커즈"
      },
      {
        id: "draft-deleted",
        photo_data_url: photo,
        analysis_status: "confirmed",
        deleted: true,
        category: "bottoms",
        name: "삭제한 바지"
      }
    ]);

    expect(summary).toEqual({
      selectedCount: 4,
      visibleCount: 3,
      analyzableCount: 1,
      reviewCount: 1,
      saveableCount: 1,
      deletedCount: 1
    });
  });
});
