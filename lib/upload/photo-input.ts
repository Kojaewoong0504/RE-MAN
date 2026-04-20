export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_ANALYSIS_IMAGE_EDGE = 1600;
export const ANALYSIS_IMAGE_QUALITY = 0.85;
export const MIN_TEXT_DESCRIPTION_LENGTH = 12;
export const IMAGE_INPUT_ACCEPT = "image/*";

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);
export const BROWSER_PREVIEW_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSION_IMAGE_TYPES: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif"
};

export type PhotoFileValidationResult =
  | { ok: true }
  | { ok: false; message: string; reason: "unsupported_type" | "too_large" | "empty_file" };

export type ImageDataUrlValidationResult =
  | { ok: true }
  | { ok: false; message: string; reason: "invalid_data_url" | "unsupported_type" | "too_large" };

const imageDataUrlPattern = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

export function inferPhotoMimeType(input: { type?: string; name?: string }) {
  if (input.type) {
    return input.type.toLowerCase();
  }

  const extension = input.name?.split(".").pop()?.toLowerCase();
  return extension ? EXTENSION_IMAGE_TYPES[extension] : undefined;
}

export function isHeicLikePhoto(input: { type?: string; name?: string }) {
  const mimeType = inferPhotoMimeType(input);
  return mimeType === "image/heic" || mimeType === "image/heif";
}

export function isBrowserPreviewableImageDataUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  const matched = /^data:(.+?);base64,/.exec(value);
  return Boolean(matched && BROWSER_PREVIEW_IMAGE_TYPES.has(matched[1].toLowerCase()));
}

export function ensureImageDataUrlMimeType(value: string, mimeType?: string) {
  if (!mimeType || !value.startsWith("data:;base64,")) {
    return value;
  }

  return value.replace(/^data:;base64,/, `data:${mimeType};base64,`);
}

export function validatePhotoFile(input: {
  type?: string;
  name?: string;
  size?: number;
}): PhotoFileValidationResult {
  if (!input.size || input.size <= 0) {
    return {
      ok: false,
      reason: "empty_file",
      message: "비어 있는 파일은 업로드할 수 없습니다."
    };
  }

  const mimeType = inferPhotoMimeType(input);

  if (!mimeType || !ALLOWED_IMAGE_TYPES.has(mimeType)) {
    return {
      ok: false,
      reason: "unsupported_type",
      message: "모바일 사진 앱의 이미지 파일만 업로드할 수 있습니다."
    };
  }

  if (input.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: "too_large",
      message: "10MB 이하 사진만 업로드할 수 있습니다."
    };
  }

  return { ok: true };
}

export function normalizeTextDescription(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function isValidTextDescription(value: string | undefined) {
  return normalizeTextDescription(value).length >= MIN_TEXT_DESCRIPTION_LENGTH;
}

function estimateBase64Bytes(base64: string) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function validateImageDataUrl(value: unknown): ImageDataUrlValidationResult {
  if (typeof value !== "string") {
    return {
      ok: false,
      reason: "invalid_data_url",
      message: "이미지 data URL 형식이 올바르지 않습니다."
    };
  }

  const match = imageDataUrlPattern.exec(value.trim());

  if (!match) {
    return {
      ok: false,
      reason: "invalid_data_url",
      message: "이미지 data URL 형식이 올바르지 않습니다."
    };
  }

  const [, mimeType, base64] = match;

  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    return {
      ok: false,
      reason: "unsupported_type",
      message: "모바일 사진 앱의 이미지 파일만 사용할 수 있습니다."
    };
  }

  if (estimateBase64Bytes(base64) > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: "too_large",
      message: "10MB 이하 이미지만 사용할 수 있습니다."
    };
  }

  return { ok: true };
}
