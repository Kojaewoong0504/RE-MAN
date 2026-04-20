import { describe, expect, it } from "vitest";
import {
  isValidTextDescription,
  MAX_UPLOAD_BYTES,
  normalizeTextDescription,
  validateImageDataUrl,
  ensureImageDataUrlMimeType,
  inferPhotoMimeType,
  isBrowserPreviewableImageDataUrl,
  validatePhotoFile
} from "@/lib/upload/photo-input";

describe("photo input validation", () => {
  it("accepts supported image files under the size limit", () => {
    expect(validatePhotoFile({ type: "image/png", size: 1024 })).toEqual({ ok: true });
  });

  it("accepts mobile HEIC and HEIF photos before client-side normalization", () => {
    expect(validatePhotoFile({ type: "image/heic", size: 1024 })).toEqual({ ok: true });
    expect(validatePhotoFile({ type: "image/heif", size: 1024 })).toEqual({ ok: true });
  });

  it("infers mobile image type from filename when browser omits MIME type", () => {
    expect(inferPhotoMimeType({ name: "style.HEIC" })).toBe("image/heic");
    expect(validatePhotoFile({ name: "style.HEIC", size: 1024 })).toEqual({ ok: true });
  });

  it("marks only browser-previewable data URLs for direct preview", () => {
    expect(isBrowserPreviewableImageDataUrl("data:image/jpeg;base64,abcd")).toBe(true);
    expect(isBrowserPreviewableImageDataUrl("data:image/heic;base64,abcd")).toBe(false);
  });

  it("patches empty FileReader data URL MIME types when the filename identifies the image", () => {
    expect(ensureImageDataUrlMimeType("data:;base64,abcd", "image/heic")).toBe(
      "data:image/heic;base64,abcd"
    );
  });

  it("rejects unsupported image types", () => {
    expect(validatePhotoFile({ type: "image/gif", size: 1024 })).toMatchObject({
      ok: false,
      reason: "unsupported_type"
    });
  });

  it("rejects oversized files", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 })).toMatchObject({
      ok: false,
      reason: "too_large"
    });
  });

  it("requires a useful text fallback description", () => {
    expect(normalizeTextDescription(" 검정   후드티와 청바지 ")).toBe("검정 후드티와 청바지");
    expect(isValidTextDescription("짧음")).toBe(false);
    expect(isValidTextDescription("검정 후드티와 청바지를 입었어요")).toBe(true);
  });

  it("validates image data URLs at the API boundary", () => {
    expect(validateImageDataUrl("data:image/png;base64,abcd")).toEqual({ ok: true });
    expect(validateImageDataUrl("data:image/gif;base64,abcd")).toMatchObject({
      ok: false,
      reason: "unsupported_type"
    });
    expect(validateImageDataUrl("not-a-data-url")).toMatchObject({
      ok: false,
      reason: "invalid_data_url"
    });
  });
});
