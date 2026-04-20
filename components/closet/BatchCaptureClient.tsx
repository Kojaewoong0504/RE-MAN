"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizeClosetDraft, type ClosetItemDraft } from "@/lib/closet/batch";
import { patchOnboardingState, readOnboardingState } from "@/lib/onboarding/storage";
import { validatePhotoFile } from "@/lib/upload/photo-input";

function createDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

function getDraftStatusLabel(status: ClosetItemDraft["analysis_status"]) {
  if (status === "pending") {
    return "대기중";
  }

  if (status === "analyzing") {
    return "분석중";
  }

  if (status === "confirmed") {
    return "저장 준비";
  }

  if (status === "failed") {
    return "실패";
  }

  return "확인 필요";
}

export function BatchCaptureClient() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ClosetItemDraft[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDrafts(readOnboardingState().closet_item_drafts ?? []);
  }, []);

  function persist(nextDrafts: ClosetItemDraft[]) {
    setDrafts(nextDrafts);
    patchOnboardingState({ closet_item_drafts: nextDrafts });
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setError("");
    const nextDrafts: ClosetItemDraft[] = [];

    for (const file of Array.from(files)) {
      const validation = validatePhotoFile(file);

      if (!validation.ok) {
        nextDrafts.push(
          normalizeClosetDraft({
            id: createDraftId(),
            photo_data_url: "",
            analysis_status: "failed",
            error_message: validation.message
          })
        );
        continue;
      }

      nextDrafts.push(
        normalizeClosetDraft({
          id: createDraftId(),
          photo_data_url: await readAsDataUrl(file),
          analysis_status: "pending"
        })
      );
    }

    persist([...drafts, ...nextDrafts]);
  }

  async function analyzeDrafts() {
    setIsAnalyzing(true);
    setError("");
    const analyzed: ClosetItemDraft[] = [];

    for (const draft of drafts) {
      if (!draft.photo_data_url || draft.analysis_status === "failed") {
        analyzed.push(draft);
        continue;
      }

      try {
        const response = await fetch("/api/closet/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: draft.photo_data_url })
        });

        if (!response.ok) {
          throw new Error("analysis_failed");
        }

        const result = await response.json();
        analyzed.push(
          normalizeClosetDraft({
            ...draft,
            ...result,
            analysis_status: "needs_review"
          })
        );
      } catch {
        analyzed.push(
          normalizeClosetDraft({
            ...draft,
            analysis_status: "failed",
            error_message: "분석 실패"
          })
        );
      }
    }

    persist(analyzed);
    setIsAnalyzing(false);
    router.push("/closet/review");
  }

  return (
    <section className="closet-batch-screen">
      <div className="closet-batch-hero">
        <p className="poster-kicker">Batch Capture</p>
        <h1>빠른 옷장 등록</h1>
        <p>여러 장을 한 번에 추가하세요. AI가 초안을 만들고 저장 전 확인만 합니다.</p>
      </div>

      <label className="closet-batch-dropzone">
        <span>사진 여러 장 선택</span>
        <input
          accept="image/*"
          className="sr-only"
          multiple
          onChange={(event) => void handleFiles(event.target.files)}
          type="file"
        />
      </label>

      <label className="closet-batch-camera">
        <span>카메라로 한 장씩 추가</span>
        <small>모바일 브라우저는 카메라 촬영을 보통 한 장씩 처리합니다.</small>
        <input
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => void handleFiles(event.target.files)}
          type="file"
        />
      </label>

      {error ? <p className="text-sm font-black text-red-700">{error}</p> : null}

      <div className="closet-batch-grid">
        {drafts.map((draft) => (
          <article className="closet-batch-tile" key={draft.id}>
            {draft.photo_data_url ? (
              <Image
                alt="옷장 등록 후보"
                height={180}
                src={draft.photo_data_url}
                unoptimized
                width={135}
              />
            ) : (
              <div>이미지 오류</div>
            )}
            <p>{getDraftStatusLabel(draft.analysis_status)}</p>
          </article>
        ))}
      </div>

      <button
        className="ui-button-accent h-14 w-full"
        disabled={drafts.length === 0 || isAnalyzing}
        onClick={() => void analyzeDrafts()}
        type="button"
      >
        {isAnalyzing ? "분석 중" : "AI 초안 만들기"}
      </button>
    </section>
  );
}
