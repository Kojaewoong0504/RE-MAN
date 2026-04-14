"use client";

import { useState } from "react";
import NextImage from "next/image";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_ANALYSIS_IMAGE_EDGE = 1600;
const ANALYSIS_IMAGE_QUALITY = 0.85;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type PhotoUploaderProps = {
  image?: string;
  textDescription?: string;
  onChange: (value: { image?: string; text_description?: string }) => void;
};

function readImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_load_failed"));
    };
    image.src = url;
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/jpeg", ANALYSIS_IMAGE_QUALITY);
}

async function normalizeImageForAnalysis(file: File) {
  const image = await readImage(file);
  const scale = Math.min(
    1,
    MAX_ANALYSIS_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("canvas_context_unavailable");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvasToDataUrl(canvas);
}

export function PhotoUploader({
  image,
  textDescription,
  onChange
}: PhotoUploaderProps) {
  const [mode, setMode] = useState<"photo" | "text">(textDescription ? "text" : "photo");
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(file: File) {
    setError(null);

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("PNG, JPG, WEBP 이미지만 업로드할 수 있습니다.");
      onChange({ image: undefined, text_description: undefined });
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError("10MB 이하 사진만 업로드할 수 있습니다.");
      onChange({ image: undefined, text_description: undefined });
      return;
    }

    const dataUrl = await normalizeImageForAnalysis(file);

    onChange({ image: dataUrl, text_description: undefined });
  }

  return (
    <div className="space-y-5">
      {mode === "photo" ? (
        <div className="space-y-5">
          <div className="space-y-2 text-left">
            <p className="poster-kicker">Photo First</p>
            <p className="text-sm leading-6 text-stone-700">
              전신, 정면, 밝은 곳이면 충분합니다. 분석용 이미지는 자동으로 1600px 이하
              JPEG로 정리됩니다.
            </p>
          </div>
          <div className="overflow-hidden bg-[#f4ecdd]">
            {image ? (
              <NextImage
                alt="업로드한 스타일 사진 미리보기"
                className="aspect-[4/5] w-full object-cover"
                height={900}
                src={image}
                unoptimized
                width={720}
              />
            ) : (
              <div className="flex aspect-[4/5] flex-col justify-end bg-[linear-gradient(160deg,#f4ecdd_0%,#fcf8ef_62%,#e8ddcc_100%)] p-6">
                <p className="text-[34px] font-black leading-[1.02] tracking-[-0.06em] text-ink">
                  지금 입은 모습 그대로
                </p>
                <p className="mt-3 max-w-xs text-sm font-bold leading-6 text-muted">
                  잘 나온 사진보다 전체 실루엣이 보이는 사진이 더 중요합니다.
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-black text-muted">
            <span className="border border-black/15 bg-[#fcf8ef] px-2 py-3">전신</span>
            <span className="border border-black/15 bg-[#fcf8ef] px-2 py-3">정면</span>
            <span className="border border-black/15 bg-[#fcf8ef] px-2 py-3">밝은 곳</span>
          </div>
          <div className="space-y-3">
            <label
              className="block cursor-pointer bg-black px-4 py-4 text-center text-sm font-black text-[#fcf8ef]"
              htmlFor="photo-upload"
            >
              {image ? "사진 다시 선택하기" : "사진 선택하기"}
            </label>
            <p className="text-center text-xs font-bold leading-5 text-muted">
              업로드된 사진은 분석 직후 삭제됩니다.
            </p>
            {error ? (
              <p className="text-center text-sm font-black leading-6 text-red-700">{error}</p>
            ) : null}
            <input
              className="sr-only"
              accept="image/png,image/jpeg,image/webp"
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
        </div>
      ) : (
        <div className="space-y-3 bg-[#fcf8ef] p-5">
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
