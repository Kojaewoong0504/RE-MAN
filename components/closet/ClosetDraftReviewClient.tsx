"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  draftToClosetItem,
  selectSaveableDrafts,
  type ClosetItemDraft
} from "@/lib/closet/batch";
import {
  normalizeClosetItems,
  patchOnboardingState,
  readOnboardingState,
  saveClosetContextToOnboardingState
} from "@/lib/onboarding/storage";
import { syncClosetItemsToServer } from "@/lib/firebase/firestore";
import type { ClosetItemCategory } from "@/lib/onboarding/storage";

function getStatusLabel(status: ClosetItemDraft["analysis_status"]) {
  return status === "confirmed" ? "확인됨" : "확인 필요";
}

const categoryOptions: Array<{ value: ClosetItemCategory; label: string }> = [
  { value: "tops", label: "상의" },
  { value: "bottoms", label: "하의" },
  { value: "shoes", label: "신발" },
  { value: "outerwear", label: "겉옷" }
];

const categoryLabels: Record<ClosetItemCategory, string> = {
  tops: "상의",
  bottoms: "하의",
  shoes: "신발",
  outerwear: "겉옷"
};

function getDraftName(draft: ClosetItemDraft) {
  if (draft.name?.trim()) {
    return draft.name.trim();
  }

  if (draft.category) {
    return `${categoryLabels[draft.category]} 사진`;
  }

  return "이름 확인 필요";
}

export function ClosetDraftReviewClient() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ClosetItemDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setDrafts(readOnboardingState().closet_item_drafts ?? []);
  }, []);

  function persist(nextDrafts: ClosetItemDraft[]) {
    setDrafts(nextDrafts);
    patchOnboardingState({ closet_item_drafts: nextDrafts });
  }

  function startEdit(draft: ClosetItemDraft) {
    setEditingId(draft.id);
    setEditName(draft.name ?? "");
  }

  function saveEdit() {
    const nextDrafts = drafts.map((draft) =>
      draft.id === editingId
        ? {
            ...draft,
            name: editName.trim() || draft.name,
            analysis_status: "confirmed" as const
          }
        : draft
    );
    persist(nextDrafts);
    setEditingId(null);
    setEditName("");
  }

  function removeDraft(id: string) {
    persist(drafts.map((draft) => (draft.id === id ? { ...draft, deleted: true } : draft)));
  }

  function confirmCategory(id: string, category: ClosetItemCategory) {
    persist(
      drafts.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              category,
              name: draft.name?.trim() || `${categoryLabels[category]} 사진`,
              analysis_status: "confirmed" as const
            }
          : draft
      )
    );
  }

  async function saveToCloset() {
    setIsSaving(true);
    setSaveError("");
    const current = readOnboardingState();
    const existingItems = normalizeClosetItems(current.closet_items);
    const nextItems = [
      ...existingItems,
      ...selectSaveableDrafts(drafts).map(draftToClosetItem)
    ];
    const localState = saveClosetContextToOnboardingState({
      items: nextItems,
      avoid: current.closet_profile?.avoid,
      size_profile: current.size_profile
    });

    patchOnboardingState({ closet_item_drafts: [] });

    try {
      const synced = await syncClosetItemsToServer({
        items: localState.closet_items ?? nextItems,
        closet_profile: localState.closet_profile,
        size_profile: localState.size_profile
      });

      if (synced.closet_items.length > 0) {
        saveClosetContextToOnboardingState({
          items: synced.closet_items,
          avoid: synced.closet_profile?.avoid ?? localState.closet_profile?.avoid,
          size_profile: localState.size_profile
        });
      }

      patchOnboardingState({ closet_item_drafts: [] });
      router.push("/closet");
    } catch {
      setSaveError("로컬에는 저장됨. 계정 동기화는 실패했습니다.");
      setIsSaving(false);
    }
  }

  const visibleDrafts = drafts.filter((draft) => !draft.deleted);

  return (
    <section className="closet-review-screen">
      <div className="closet-batch-hero">
        <p className="poster-kicker">Review</p>
        <h1>저장 전 확인</h1>
        <p>AI 초안은 확정 전까지 추천 근거로 쓰지 않습니다.</p>
      </div>

      {visibleDrafts.length > 0 ? (
        <div className="closet-review-list">
          {visibleDrafts.map((draft) => (
            <article className="closet-review-card" key={draft.id}>
              {draft.photo_data_url ? (
                <Image
                  alt={`${getDraftName(draft)} 후보`}
                  height={160}
                  src={draft.photo_data_url}
                  unoptimized
                  width={120}
                />
              ) : (
                <div className="closet-review-photo-empty">이미지 없음</div>
              )}
              <div className="space-y-3">
                <div>
                  <p className="poster-kicker">{getStatusLabel(draft.analysis_status)}</p>
                  <h2>{getDraftName(draft)}</h2>
                  <p>
                    {[draft.color, draft.detected_type, draft.season]
                      .filter(Boolean)
                      .join(" · ") || "정보 확인 필요"}
                  </p>
                  <p>사이즈: {draft.size_source === "unknown" ? "확인 필요" : draft.size}</p>
                </div>

                <div className="closet-review-category-grid" aria-label={`${getDraftName(draft)} 종류`}>
                  {categoryOptions.map((option) => (
                    <button
                      aria-pressed={draft.category === option.value}
                      className={draft.category === option.value ? "closet-review-category-selected" : ""}
                      key={option.value}
                      onClick={() => confirmCategory(draft.id, option.value)}
                      type="button"
                    >
                      {option.label}로 분류
                    </button>
                  ))}
                </div>

                {editingId === draft.id ? (
                  <div className="grid gap-2">
                    <label className="grid gap-1 text-xs font-black">
                      이름
                      <input
                        aria-label="이름"
                        className="ui-input"
                        onChange={(event) => setEditName(event.target.value)}
                        value={editName}
                      />
                    </label>
                    <button className="ui-button-accent h-11" onClick={saveEdit} type="button">
                      수정 저장
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      aria-label={`${draft.name} 수정`}
                      className="ui-button-secondary h-11 flex-1"
                      onClick={() => startEdit(draft)}
                      type="button"
                    >
                      수정
                    </button>
                    <button
                      aria-label={`${draft.name} 삭제`}
                      className="ui-button-secondary h-11 flex-1"
                      onClick={() => removeDraft(draft.id)}
                      type="button"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>확인할 옷이 없습니다.</p>
        </div>
      )}

      {saveError ? <p className="text-sm font-black text-red-700">{saveError}</p> : null}

      <button
        className="ui-button-accent h-14 w-full"
        disabled={selectSaveableDrafts(drafts).length === 0 || isSaving}
        onClick={() => void saveToCloset()}
        type="button"
      >
        {isSaving ? "저장 중" : "옷장에 저장"}
      </button>
    </section>
  );
}
