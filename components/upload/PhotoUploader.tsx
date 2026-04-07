"use client";

import { useState } from "react";

export function PhotoUploader() {
  const [mode, setMode] = useState<"photo" | "text">("photo");

  return (
    <div className="space-y-5">
      <button
        className="text-sm text-muted underline underline-offset-4"
        onClick={() => setMode((current) => (current === "photo" ? "text" : "photo"))}
        type="button"
      >
        {mode === "photo" ? "오늘 입은 옷 설명하기" : "사진 업로드로 돌아가기"}
      </button>
      {mode === "photo" ? (
        <div className="rounded-2xl border border-dashed border-white/20 bg-black/20 p-8 text-center">
          <p className="text-lg font-semibold">사진 업로드 영역</p>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            얼굴 포함 전신 사진, 자연광, 정면 촬영을 권장합니다.
          </p>
          <div className="mt-6 rounded-xl bg-white/10 px-4 py-3 text-sm text-white">
            drag &amp; drop 또는 파일 선택이 이 자리에 들어옵니다.
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl bg-surface p-5">
          <label className="text-sm font-semibold" htmlFor="text-description">
            오늘 입은 옷 설명
          </label>
          <textarea
            className="min-h-40 w-full rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-muted"
            id="text-description"
            placeholder="예: 검은 후드티, 중청 와이드 데님, 회색 운동화"
          />
        </div>
      )}
    </div>
  );
}
