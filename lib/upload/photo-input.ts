export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_ANALYSIS_IMAGE_EDGE = 1600;
export const ANALYSIS_IMAGE_QUALITY = 0.85;
export const MIN_TEXT_DESCRIPTION_LENGTH = 12;

export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type PhotoFileValidationResult =
  | { ok: true }
  | { ok: false; message: string; reason: "unsupported_type" | "too_large" | "empty_file" };

export type ImageDataUrlValidationResult =
  | { ok: true }
  | { ok: false; message: string; reason: "invalid_data_url" | "unsupported_type" | "too_large" };

const imageDataUrlPattern = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

export function validatePhotoFile(input: { type?: string; size?: number }): PhotoFileValidationResult {
  if (!input.size || input.size <= 0) {
    return {
      ok: false,
      reason: "empty_file",
      message: "비어 있는 파일은 업로드할 수 없습니다."
    };
  }

  if (!input.type || !ALLOWED_IMAGE_TYPES.has(input.type)) {
    return {
      ok: false,
      reason: "unsupported_type",
      message: "PNG, JPG, WEBP 이미지만 업로드할 수 있습니다."
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
      message: "PNG, JPG, WEBP 이미지만 사용할 수 있습니다."
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
