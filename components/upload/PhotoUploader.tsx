"use client";

import { useState } from "react";

type PhotoUploaderProps = {
  image?: string;
  textDescription?: string;
  onChange: (value: { image?: string; text_description?: string }) => void;
};

export function PhotoUploader({
  image,
  textDescription,
  onChange
}: PhotoUploaderProps) {
  const [mode, setMode] = useState<"photo" | "text">(textDescription ? "text" : "photo");

  async function handleFileChange(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }

        reject(new Error("invalid_file_result"));
      };
      reader.onerror = () => reject(reader.error ?? new Error("file_read_failed"));
      reader.readAsDataURL(file);
    });

    onChange({ image: dataUrl, text_description: undefined });
  }

  return (
    <div className="space-y-5">
      <button
        className="text-sm text-muted underline underline-offset-4"
        onClick={() =>
          setMode((current) => {
            const nextMode = current === "photo" ? "text" : "photo";

            if (nextMode === "photo") {
              onChange({ image, text_description: undefined });
            } else {
              onChange({ image: undefined, text_description: textDescription ?? "" });
            }

            return nextMode;
          })
        }
        type="button"
      >
        {mode === "photo" ? "오늘 입은 옷 설명하기" : "사진 업로드로 돌아가기"}
      </button>
      {mode === "photo" ? (
        <div className="space-y-5 border-t-2 border-black bg-[#fcf8ef] p-6">
          <div className="space-y-2 text-left">
            <p className="poster-kicker">Upload</p>
            <p className="text-[28px] font-black leading-[1.05] tracking-[-0.04em] text-ink">
              사진 한 장이면 충분합니다
            </p>
            <p className="text-sm leading-6 text-stone-700">
              얼굴 포함 전신 사진, 자연광, 정면 촬영을 권장합니다.
            </p>
          </div>
          <div className="border-2 border-dashed border-black bg-[#f4ecdd] px-5 py-8 text-center">
            <p className="text-base font-black tracking-tight text-ink">
              {image ? "사진 업로드 준비 완료" : "drag & drop 또는 파일 선택"}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              업로드된 사진은 분석 직후 삭제됩니다.
            </p>
          </div>
          <label
            className="block cursor-pointer border-2 border-black bg-accent px-4 py-4 text-center text-sm font-black text-black"
            htmlFor="photo-upload"
          >
            파일 선택하기
          </label>
          <input
            className="sr-only"
            id="photo-upload"
            onChange={async (event) => {
              const file = event.target.files?.[0];

              if (!file) {
                return;
              }

              await handleFileChange(file);
            }}
            type="file"
          />
        </div>
      ) : (
        <div className="space-y-3 border-t-2 border-black bg-[#fcf8ef] p-5">
          <label
            className="text-sm font-black uppercase tracking-[0.22em] text-muted"
            htmlFor="text-description"
          >
            오늘 입은 옷 설명
          </label>
          <textarea
            className="min-h-40 w-full border-2 border-black bg-white p-4 text-sm text-ink outline-none placeholder:text-muted"
            id="text-description"
            onChange={(event) =>
              onChange({
                image: undefined,
                text_description: event.target.value
              })
            }
            placeholder="예: 검은 후드티, 중청 와이드 데님, 회색 운동화"
            value={textDescription ?? ""}
          />
        </div>
      )}
    </div>
  );
}
