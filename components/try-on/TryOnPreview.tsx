"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { TRY_ON_MAX_IMAGE_BYTES } from "@/lib/agents/try-on-contract";

type TryOnPreviewProps = {
  personImage?: string;
  prompt: string;
  recommendation: {
    title: string;
    items: [string, string, string];
    reason: string;
  };
};

type TryOnState =
  | { status: "idle"; message: string | null; previewImage: string | null }
  | { status: "loading"; message: string | null; previewImage: string | null }
  | { status: "ready"; message: string; previewImage: string; provider: "mocked" | "vertex" }
  | { status: "error"; message: string; previewImage: string | null };

type TryOnProviderState = {
  provider: "mock" | "vertex";
  realGenerationEnabled: boolean;
  modelId: string | null;
  missingConfig: string[];
  authSource: "env" | "gcloud" | "missing";
};

type ReferencePreset = {
  id: string;
  label: string;
  description: string;
  palette: {
    background: string;
    top: string;
    bottom: string;
    shoes: string;
  };
};

const referencePresets: ReferencePreset[] = [
  {
    id: "recommended",
    label: "추천 조합 그대로",
    description: "AI가 반환한 상의, 하의, 신발 조합을 기준으로 만든 기본 레퍼런스",
    palette: {
      background: "#fcf8ef",
      top: "#2f4b7c",
      bottom: "#202733",
      shoes: "#f6f0df"
    }
  },
  {
    id: "clean",
    label: "더 단정한 버전",
    description: "소개팅과 첫인상에 맞게 톤을 낮춘 깔끔한 레퍼런스",
    palette: {
      background: "#f4ecdd",
      top: "#222222",
      bottom: "#3f3f46",
      shoes: "#f7f2e8"
    }
  },
  {
    id: "casual",
    label: "가벼운 캐주얼 버전",
    description: "주말에도 부담 없이 입을 수 있게 밝게 정리한 레퍼런스",
    palette: {
      background: "#efe7d8",
      top: "#6b8fb5",
      bottom: "#2f4f6f",
      shoes: "#ffffff"
    }
  }
];

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function truncateLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function buildReferenceImage(
  preset: ReferencePreset,
  recommendation: TryOnPreviewProps["recommendation"]
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("canvas_context_unavailable");
  }

  canvas.width = 768;
  canvas.height = 1024;
  context.fillStyle = preset.palette.background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "#111111";
  context.lineWidth = 5;
  context.fillStyle = "#111111";
  context.font = "700 34px sans-serif";
  context.fillText("RE:MAN REFERENCE", 52, 84);
  context.font = "900 50px sans-serif";
  context.fillText(preset.label, 52, 148);

  context.fillStyle = preset.palette.top;
  drawRoundedRect(context, 238, 230, 292, 260, 32);
  context.fill();
  context.stroke();

  context.fillStyle = preset.palette.bottom;
  drawRoundedRect(context, 265, 505, 110, 300, 28);
  context.fill();
  context.stroke();
  drawRoundedRect(context, 392, 505, 110, 300, 28);
  context.fill();
  context.stroke();

  context.fillStyle = preset.palette.shoes;
  drawRoundedRect(context, 218, 830, 178, 64, 28);
  context.fill();
  context.stroke();
  drawRoundedRect(context, 372, 830, 178, 64, 28);
  context.fill();
  context.stroke();

  context.fillStyle = "#111111";
  context.font = "800 24px sans-serif";
  context.fillText(truncateLabel(recommendation.items[0]), 52, 948);
  context.fillText(truncateLabel(recommendation.items[1]), 52, 982);
  context.fillText(truncateLabel(recommendation.items[2]), 52, 1016);

  return canvas.toDataURL("image/png");
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
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
}

export function TryOnPreview({ personImage, prompt, recommendation }: TryOnPreviewProps) {
  const [productImage, setProductImage] = useState<string | null>(null);
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [tryOnState, setTryOnState] = useState<TryOnState>({
    status: "idle",
    message: null,
    previewImage: null
  });
  const [providerState, setProviderState] = useState<TryOnProviderState>({
    provider: "mock",
    realGenerationEnabled: false,
    modelId: null,
    missingConfig: [],
    authSource: "missing"
  });

  const isDisabled =
    !personImage ||
    !productImage ||
    !providerState.realGenerationEnabled ||
    tryOnState.status === "loading";

  useEffect(() => {
    let mounted = true;

    async function readProviderState() {
      const response = await fetch("/api/try-on", {
        method: "GET"
      }).catch(() => null);

      if (!mounted || !response?.ok) {
        return;
      }

      const data = (await response.json().catch(() => null)) as
        | {
            provider?: "mock" | "vertex";
            real_generation_enabled?: boolean;
            model_id?: string;
            missing_config?: string[];
            auth_source?: "env" | "gcloud" | "missing";
          }
        | null;

      if (!data?.provider) {
        return;
      }

      setProviderState({
        provider: data.provider,
        realGenerationEnabled: Boolean(data.real_generation_enabled),
        modelId: data.model_id ?? null,
        missingConfig: data.missing_config ?? [],
        authSource: data.auth_source ?? "missing"
      });
    }

    void readProviderState();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleProductImageChange(file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setTryOnState({
        status: "error",
        message: "상품 이미지는 PNG, JPG, WEBP만 사용할 수 있습니다.",
        previewImage: null
      });
      return;
    }

    if (file.size > TRY_ON_MAX_IMAGE_BYTES) {
      setTryOnState({
        status: "error",
        message: "상품 이미지는 10MB 이하만 사용할 수 있습니다.",
        previewImage: null
      });
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setProductImage(dataUrl);
    setSelectedReference(null);
    setTryOnState({
      status: "idle",
      message: providerState.realGenerationEnabled
        ? "업로드한 상품 이미지가 준비됐습니다. 실착 미리보기를 생성할 수 있습니다."
        : "업로드한 상품 이미지는 준비됐지만, 현재 환경에서는 실제 실착 생성 provider가 비활성화되어 있습니다.",
      previewImage: null
    });
  }

  function handleReferenceSelect(preset: ReferencePreset) {
    const dataUrl = buildReferenceImage(preset, recommendation);

    setProductImage(dataUrl);
    setSelectedReference(preset.id);
    setTryOnState({
      status: "idle",
      message: providerState.realGenerationEnabled
        ? `${preset.label} 레퍼런스가 준비됐습니다. 실착 생성을 요청할 수 있습니다.`
        : `${preset.label} 레퍼런스가 준비됐습니다. 현재는 실제 실착 생성이 아니라 레퍼런스 확인까지만 가능합니다.`,
      previewImage: null
    });
  }

  async function handleTryOn() {
    if (!personImage || !productImage || !providerState.realGenerationEnabled) {
      return;
    }

    setTryOnState({
      status: "loading",
      message: "실착 미리보기를 생성하는 중입니다.",
      previewImage: null
    });

    const response = await fetch("/api/try-on", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        person_image: personImage,
        product_image: productImage,
        prompt
      })
    });
    const data = (await response.json().catch(() => null)) as
      | { preview_image?: string; message?: string; status?: "mocked" | "vertex" }
      | null;

    if (response.status === 401) {
      setTryOnState({
        status: "error",
        message: "실착 미리보기는 비용이 발생할 수 있어 로그인 후에만 사용할 수 있습니다.",
        previewImage: null
      });
      return;
    }

    if (response.status === 429) {
      setTryOnState({
        status: "error",
        message: "실착 미리보기 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        previewImage: null
      });
      return;
    }

    if (!response.ok || !data?.preview_image) {
      setTryOnState({
        status: "error",
        message: "실착 미리보기를 만들지 못했습니다. 상품 이미지를 다시 확인해 주세요.",
        previewImage: null
      });
      return;
    }

    setTryOnState({
      status: "ready",
      message: data.message ?? "실착 미리보기가 준비됐습니다.",
      previewImage: data.preview_image,
      provider: data.status ?? "mocked"
    });
  }

  return (
    <section className="space-y-5 border-t border-black/15 pt-6">
      <div className="space-y-2">
        <p className="poster-kicker">Reference / Try-On</p>
        <h2 className="text-[31px] font-black leading-[1.04] tracking-[-0.05em] text-ink">
          추천 조합을 눈으로 확인합니다
        </h2>
        <p className="max-w-md text-[15px] font-medium leading-7 text-muted">
          {providerState.realGenerationEnabled
            ? "비용이 발생할 수 있는 기능이라 로그인 후 사용할 수 있습니다. 현재 Vertex provider로 실제 생성이 활성화되어 있습니다."
            : "현재 환경은 mock provider라 실제 실착 이미지를 생성하지 않습니다. 아래 레퍼런스는 추천 조합을 이해하기 위한 미리보기입니다."}
        </p>
        <Link
          className="inline-block text-sm font-black text-ink underline underline-offset-4"
          href="/login?returnTo=/programs/style/onboarding/result"
        >
          로그인하고 실착 미리보기 사용하기
        </Link>
      </div>

      {!personImage ? (
        <div className="border border-black/15 bg-[#fcf8ef] p-5">
          <p className="text-sm font-bold leading-6 text-ink">
            텍스트 설명으로 진행한 경우 실착 미리보기를 만들 수 없습니다. 전신 사진을 다시
            업로드하면 상품 이미지와 함께 확인할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="space-y-3 bg-[#fcf8ef] p-4">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-muted">
                Reference Images
              </p>
              <p className="text-sm font-bold leading-6 text-ink">
                상품 이미지가 없다면 서비스가 준비한 레퍼런스를 먼저 확인하세요.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {referencePresets.map((preset) => {
                const selected = selectedReference === preset.id;

                return (
                  <button
                    key={preset.id}
                    aria-pressed={selected}
                    className={`border p-3 text-left transition ${
                      selected
                        ? "border-black bg-black text-[#fcf8ef]"
                        : "border-black/15 bg-white text-ink"
                    }`}
                    onClick={() => handleReferenceSelect(preset)}
                    type="button"
                  >
                    <span className="block text-sm font-black">{preset.label}</span>
                    <span className="mt-2 block text-xs font-semibold leading-5 opacity-75">
                      {preset.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-[#fcf8ef] p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-muted">
                Person Image
              </p>
              <Image
                alt="업로드한 전신 사진"
                className="mt-3 aspect-[3/4] w-full object-cover grayscale"
                height={640}
                unoptimized
                src={personImage}
                width={480}
              />
            </div>
            <div className="bg-[#fcf8ef] p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-muted">
                Product Image
              </p>
              {productImage ? (
                <Image
                  alt="업로드한 상품 이미지"
                  className="mt-3 aspect-[3/4] w-full object-cover"
                  height={640}
                  unoptimized
                  src={productImage}
                  width={480}
                />
              ) : (
                <div className="mt-3 flex aspect-[3/4] items-center justify-center border border-dashed border-black/30 bg-[#f4ecdd] px-5 text-center text-sm font-black leading-6 text-ink">
                  입혀보고 싶은 상품 이미지를 올려주세요
                </div>
              )}
            </div>
          </div>

          <div className="bg-accent p-4 text-black">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-black/70">
              Prompt
            </p>
            <p className="mt-2 text-sm font-bold leading-6">{prompt}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label
              className="block cursor-pointer border border-black/20 bg-[#fcf8ef] px-4 py-4 text-center text-sm font-black text-ink"
              htmlFor="try-on-product-upload"
            >
              내 상품 이미지 선택
            </label>
            <input
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              id="try-on-product-upload"
              onChange={async (event) => {
                const file = event.target.files?.[0];

                if (!file) {
                  return;
                }

                await handleProductImageChange(file);
              }}
              type="file"
            />
            <button
              className="border border-black bg-black px-5 py-4 text-sm font-black text-[#fcf8ef] disabled:cursor-not-allowed disabled:bg-black/40"
              disabled={isDisabled}
              onClick={handleTryOn}
              type="button"
            >
              {tryOnState.status === "loading"
                ? "생성 중..."
                : providerState.realGenerationEnabled
                  ? "실착 미리보기 생성"
                  : "실제 실착 생성 비활성화"}
            </button>
          </div>

          {!providerState.realGenerationEnabled ? (
            <p className="border border-black/15 bg-[#fcf8ef] p-4 text-sm font-black leading-6 text-ink">
              실제 실착 생성은 아직 활성화되지 않았습니다. `TRY_ON_PROVIDER=vertex`와
              `VERTEX_*` 서버 환경변수가 준비된 뒤에만 생성 버튼을 열 수 있습니다.
              {providerState.missingConfig.length > 0
                ? ` 현재 누락: ${providerState.missingConfig.join(", ")}`
                : ""}
            </p>
          ) : null}

          <p className="text-xs font-bold leading-5 text-muted">
            provider: {providerState.provider}
            {providerState.modelId ? ` / model: ${providerState.modelId}` : ""}
            {providerState.authSource !== "missing" ? ` / auth: ${providerState.authSource}` : ""}
          </p>

          {tryOnState.message ? (
            <p className="text-sm font-bold leading-6 text-muted">{tryOnState.message}</p>
          ) : null}

          {tryOnState.status === "ready" ? (
            <div className="bg-black p-4 text-[#fcf8ef]">
              <p className="poster-kicker text-[#fcf8ef]/70">
                {tryOnState.provider === "vertex" ? "Vertex Result" : "Mock Result"}
              </p>
              <Image
                alt="실착 미리보기 결과"
                className="mt-4 aspect-[3/4] w-full object-cover"
                height={640}
                unoptimized
                src={tryOnState.previewImage}
                width={480}
              />
              <p className="mt-3 text-sm font-bold leading-6">
                {tryOnState.provider === "vertex"
                  ? "Vertex provider가 생성한 실착 미리보기입니다."
                  : "mock provider에서는 업로드한 전신 사진을 그대로 반환해 흐름만 검증합니다."}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
