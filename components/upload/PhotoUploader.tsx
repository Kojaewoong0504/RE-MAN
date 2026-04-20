"use client";

import { useState } from "react";
import NextImage from "next/image";
import { normalizePhotoForBrowserUpload } from "@/lib/upload/browser-normalize";
import {
  IMAGE_INPUT_ACCEPT,
  isBrowserPreviewableImageDataUrl,
  isValidTextDescription,
  MIN_TEXT_DESCRIPTION_LENGTH,
  normalizeTextDescription,
  validatePhotoFile
} from "@/lib/upload/photo-input";

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
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(file: File) {
    setError(null);

    const validation = validatePhotoFile(file);

    if (!validation.ok) {
      setError(validation.message);
      onChange({ image: undefined, text_description: undefined });
      return;
    }

    try {
      const dataUrl = await normalizePhotoForBrowserUpload(file);
      onChange({ image: dataUrl, text_description: undefined });
    } catch {
      setError("사진을 처리하지 못했습니다. JPG 또는 PNG 사진을 다시 선택해주세요.");
      onChange({ image: undefined, text_description: undefined });
    }
  }

  return (
    <div className="space-y-5">
      {mode === "photo" ? (
        <div className="space-y-5">
          <div className="space-y-1 text-left">
            <p className="poster-kicker">Photo First</p>
            <p className="text-sm font-semibold leading-6 text-muted">
              전신이 보이면 됩니다.
            </p>
          </div>
          <div className="work-surface overflow-hidden">
            {image && isBrowserPreviewableImageDataUrl(image) ? (
              <NextImage
                alt="업로드한 스타일 사진 미리보기"
                className="aspect-[4/5] w-full object-cover"
                height={900}
                src={image}
                unoptimized
                width={720}
              />
            ) : image ? (
              <div className="flex aspect-[4/5] flex-col justify-end bg-[linear-gradient(160deg,#eef1ed_0%,#fcf8ef_62%,#dfe5dc_100%)] p-6">
                <p className="text-[34px] font-black leading-[1.02] tracking-[-0.06em] text-ink">
                  사진 선택 완료
                </p>
                <p className="mt-3 max-w-xs text-sm font-bold leading-6 text-muted">
                  분석할 사진이 준비되었습니다.
                </p>
              </div>
            ) : (
              <div className="flex aspect-[4/5] flex-col justify-end bg-[linear-gradient(160deg,#f4ecdd_0%,#fcf8ef_62%,#e8ddcc_100%)] p-6">
                <p className="text-[34px] font-black leading-[1.02] tracking-[-0.06em] text-ink">
                  지금 입은 모습 그대로
                </p>
                <p className="mt-3 max-w-xs text-sm font-bold leading-6 text-muted">
                  전신, 정면, 밝은 곳.
                </p>
              </div>
            )}
          </div>
          <div className="metric-strip grid-cols-3 text-xs font-black text-muted">
            <span className="metric-cell">전신</span>
            <span className="metric-cell">정면</span>
            <span className="metric-cell">밝은 곳</span>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label
                className="ui-button cursor-pointer py-4"
                htmlFor="photo-upload"
              >
                {image ? "다시 선택" : "사진 선택"}
              </label>
              <label
                className="ui-button-secondary cursor-pointer justify-center py-4"
                htmlFor="photo-camera"
              >
                카메라 촬영
              </label>
            </div>
            <p className="text-center text-xs font-bold leading-5 text-muted">
              분석 후 삭제.
            </p>
            {error ? (
              <p className="text-center text-sm font-black leading-6 text-red-700">{error}</p>
            ) : null}
            <input
              className="sr-only"
              accept={IMAGE_INPUT_ACCEPT}
              id="photo-upload"
              onChange={async (event) => {
                const file = event.target.files?.[0];

                if (!file) {
                  return;
                }

                await handleFileChange(file);
                event.target.value = "";
              }}
              type="file"
            />
            <input
              className="sr-only"
              accept={IMAGE_INPUT_ACCEPT}
              capture="environment"
              id="photo-camera"
              onChange={async (event) => {
                const file = event.target.files?.[0];

                if (!file) {
                  return;
                }

                await handleFileChange(file);
                event.target.value = "";
              }}
              type="file"
            />
          </div>
        </div>
      ) : (
        <div className="work-surface space-y-3 p-5">
          <label
            className="text-sm font-black uppercase tracking-[0.22em] text-muted"
            htmlFor="text-description"
          >
            오늘 입은 옷 설명
          </label>
          <textarea
            className="min-h-40 w-full border border-black/20 bg-white p-4 text-sm text-ink outline-none placeholder:text-muted focus:border-black"
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
          <p className="text-xs font-bold leading-5 text-muted">
            최소 {MIN_TEXT_DESCRIPTION_LENGTH}자.
            {textDescription && !isValidTextDescription(textDescription)
              ? ` 현재 ${normalizeTextDescription(textDescription).length}자입니다.`
              : ""}
          </p>
        </div>
      )}
      <button
        className="text-sm font-black text-muted underline underline-offset-4"
        onClick={() =>
          setMode((current) => {
            const nextMode = current === "photo" ? "text" : "photo";

            if (nextMode === "photo") {
              onChange({ image, text_description: undefined });
            } else {
              setError(null);
              onChange({ image: undefined, text_description: textDescription ?? "" });
            }

            return nextMode;
          })
        }
        type="button"
      >
        {mode === "photo" ? "사진 없이 옷 설명으로 진행하기" : "사진 업로드로 돌아가기"}
      </button>
    </div>
  );
}
