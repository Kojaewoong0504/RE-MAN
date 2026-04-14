import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateTryOnPreview,
  resolveTryOnProvider,
  validateTryOnRequest
} from "@/lib/agents/try-on";
import {
  TRY_ON_MAX_IMAGE_BYTES,
  TRY_ON_MAX_PROMPT_LENGTH
} from "@/lib/agents/try-on-contract";

const image = "data:image/png;base64,abc123";
const oversizedImage = `data:image/png;base64,${"a".repeat(
  Math.ceil(((TRY_ON_MAX_IMAGE_BYTES + 1) * 4) / 3)
)}`;

describe("try-on provider contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("accepts one person image, one product image, and a prompt", () => {
    expect(
      validateTryOnRequest({
        person_image: image,
        product_image: image,
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).toBe(true);
  });

  it("rejects missing product images", () => {
    expect(
      validateTryOnRequest({
        person_image: image,
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).toBe(false);
  });

  it("rejects unsupported image MIME types", () => {
    expect(
      validateTryOnRequest({
        person_image: "data:image/gif;base64,abc123",
        product_image: image,
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).toBe(false);
  });

  it("rejects oversized images", () => {
    expect(
      validateTryOnRequest({
        person_image: oversizedImage,
        product_image: image,
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).toBe(false);
  });

  it("rejects prompts over the length limit", () => {
    expect(
      validateTryOnRequest({
        person_image: image,
        product_image: image,
        prompt: "a".repeat(TRY_ON_MAX_PROMPT_LENGTH + 1)
      })
    ).toBe(false);
  });

  it("uses mock provider unless Vertex is explicitly enabled", () => {
    vi.stubEnv("TRY_ON_PROVIDER", "mock");
    expect(resolveTryOnProvider()).toBe("mock");

    vi.stubEnv("TRY_ON_PROVIDER", "vertex");
    expect(resolveTryOnProvider()).toBe("vertex");
  });

  it("returns the person image in mock mode", async () => {
    vi.stubEnv("TRY_ON_PROVIDER", "mock");

    await expect(
      generateTryOnPreview({
        person_image: image,
        product_image: image,
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).resolves.toMatchObject({
      status: "mocked",
      preview_image: image
    });
  });

  it("requires explicit Vertex configuration before calling the Vertex provider", async () => {
    vi.stubEnv("TRY_ON_PROVIDER", "vertex");

    await expect(
      generateTryOnPreview({
        person_image: image,
        product_image: image,
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).rejects.toThrow("missing_vertex_try_on_config");
  });

  it("calls Vertex Virtual Try-On when the provider is enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        predictions: [
          {
            mimeType: "image/png",
            bytesBase64Encoded: "result123"
          }
        ]
      })
    });

    vi.stubEnv("TRY_ON_PROVIDER", "vertex");
    vi.stubEnv("VERTEX_PROJECT_ID", "project-1");
    vi.stubEnv("VERTEX_LOCATION", "us-central1");
    vi.stubEnv("VERTEX_ACCESS_TOKEN", "access-token");
    vi.stubEnv("VERTEX_TRY_ON_STORAGE_URI", "gs://bucket/try-on");
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateTryOnPreview({
        person_image: image,
        product_image: image,
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).resolves.toMatchObject({
      status: "vertex",
      preview_image: "data:image/png;base64,result123"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://us-central1-aiplatform.googleapis.com/v1/projects/project-1/locations/us-central1/publishers/google/models/virtual-try-on-001:predict",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token"
        })
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      parameters: {
        sampleCount: 1,
        storageUri: "gs://bucket/try-on"
      }
    });
  });
});
