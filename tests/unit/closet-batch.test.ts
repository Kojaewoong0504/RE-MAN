import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_REVIEW_THRESHOLD,
  draftToClosetItem,
  normalizeClosetDraft,
  selectSaveableDrafts
} from "@/lib/closet/batch";

const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

describe("closet batch drafts", () => {
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
});
