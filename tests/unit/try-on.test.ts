import { afterEach, describe, expect, it, vi } from "vitest";
import {
  estimateTryOnPassCount,
  generateTryOnPreview,
  getTryOnRuntimeStatus,
  resolvePreferredVertexAccessToken,
  resolveTryOnProvider,
  TryOnProviderError,
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

  it("accepts one person image, variable product images, and a prompt", () => {
    expect(
      validateTryOnRequest({
        person_image: image,
        product_images: [image, image, image],
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

  it("accepts more than three product images at the app contract layer", () => {
    expect(
      validateTryOnRequest({
        person_image: image,
        product_images: [image, image, image, image],
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).toBe(true);
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

  it("prefers a fresh gcloud token over env token in local development", () => {
    expect(
      resolvePreferredVertexAccessToken({
        nodeEnv: "development",
        envToken: "stale-env-token",
        gcloudToken: "fresh-gcloud-token",
        serviceAccountToken: null
      })
    ).toBe("fresh-gcloud-token");
  });

  it("keeps env token as the primary source in production", () => {
    expect(
      resolvePreferredVertexAccessToken({
        nodeEnv: "production",
        envToken: "server-env-token",
        gcloudToken: "fresh-gcloud-token",
        serviceAccountToken: null
      })
    ).toBe("server-env-token");
  });

  it("prefers a service account token over env token when available", () => {
    expect(
      resolvePreferredVertexAccessToken({
        nodeEnv: "production",
        envToken: "server-env-token",
        gcloudToken: null,
        serviceAccountToken: "service-account-token"
      })
    ).toBe("service-account-token");
  });

  it("does not report Vertex config as missing while mock provider is active", () => {
    vi.stubEnv("TRY_ON_PROVIDER", "mock");

    expect(getTryOnRuntimeStatus()).toMatchObject({
      provider: "mock",
      real_generation_enabled: false,
      missing_config: []
    });
  });

  it("reports the current Vertex pass limit in runtime status", () => {
    vi.stubEnv("TRY_ON_PROVIDER", "vertex");
    vi.stubEnv("VERTEX_PROJECT_ID", "project-1");
    vi.stubEnv("VERTEX_LOCATION", "us-central1");
    vi.stubEnv("VERTEX_ACCESS_TOKEN", "access-token");
    vi.stubEnv("VERTEX_TRY_ON_MAX_PRODUCT_IMAGES", "2");

    expect(getTryOnRuntimeStatus()).toMatchObject({
      max_product_images_per_pass: 2
    });
  });

  it("estimates try-on pass count from the current adapter limit", () => {
    vi.stubEnv("VERTEX_TRY_ON_MAX_PRODUCT_IMAGES", "2");

    expect(
      estimateTryOnPassCount({
        person_image: image,
        product_images: [image, image, image, image, image],
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).toBe(3);
  });

  it("reports missing Vertex config only when Vertex provider is active", () => {
    vi.stubEnv("TRY_ON_PROVIDER", "vertex");

    expect(getTryOnRuntimeStatus()).toMatchObject({
      provider: "vertex",
      real_generation_enabled: false,
      missing_config: expect.arrayContaining([
        "VERTEX_PROJECT_ID",
        "VERTEX_LOCATION"
      ])
    });
  });

  it("treats Firebase service-account credentials as a valid Vertex auth source", () => {
    vi.stubEnv("TRY_ON_PROVIDER", "vertex");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERTEX_PROJECT_ID", "project-1");
    vi.stubEnv("VERTEX_LOCATION", "us-central1");
    vi.stubEnv(
      "FIREBASE_CLIENT_EMAIL",
      "firebase-admin@test-project.iam.gserviceaccount.com"
    );
    vi.stubEnv(
      "FIREBASE_PRIVATE_KEY",
      "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----\\n"
    );

    expect(getTryOnRuntimeStatus()).toMatchObject({
      provider: "vertex",
      real_generation_enabled: true,
      auth_source: "service_account"
    });
  });

  it("returns the person image in mock mode", async () => {
    vi.stubEnv("TRY_ON_PROVIDER", "mock");

    await expect(
      generateTryOnPreview({
        person_image: image,
        product_images: [image, image, image],
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

    await expect(
      generateTryOnPreview({
        person_image: image,
        product_image: image,
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).rejects.toMatchObject({
      code: "missing_vertex_config",
      statusHint: 503
    });
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
    vi.stubEnv("NODE_ENV", "production");
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
      instances: [
        {
          productImages: [
            { image: { bytesBase64Encoded: "abc123" } }
          ]
        }
      ],
      parameters: {
        sampleCount: 1,
        storageUri: "gs://bucket/try-on"
      }
    });
  });

  it("splits productImages into sequential single-item passes at the Vertex adapter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          predictions: [
            {
              mimeType: "image/png",
              bytesBase64Encoded: "result-stage-1"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          predictions: [
            {
              mimeType: "image/png",
              bytesBase64Encoded: "result-stage-2"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          predictions: [
            {
              mimeType: "image/png",
              bytesBase64Encoded: "result-stage-3"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          predictions: [
            {
              mimeType: "image/png",
              bytesBase64Encoded: "result-stage-4"
            }
          ]
        })
      });

    vi.stubEnv("TRY_ON_PROVIDER", "vertex");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERTEX_PROJECT_ID", "project-1");
    vi.stubEnv("VERTEX_LOCATION", "us-central1");
    vi.stubEnv("VERTEX_ACCESS_TOKEN", "access-token");
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateTryOnPreview({
        person_image: image,
        product_images: [image, image, image, image],
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).resolves.toMatchObject({
      status: "vertex",
      preview_image: "data:image/png;base64,result-stage-4"
    });

    const firstRequestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const secondRequestBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const thirdRequestBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    const fourthRequestBody = JSON.parse(fetchMock.mock.calls[3][1].body);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(firstRequestBody.instances[0].productImages).toHaveLength(1);
    expect(secondRequestBody.instances[0].productImages).toHaveLength(1);
    expect(thirdRequestBody.instances[0].productImages).toHaveLength(1);
    expect(fourthRequestBody.instances[0].productImages).toHaveLength(1);
    expect(secondRequestBody.instances[0].personImage.image.bytesBase64Encoded).toBe(
      "result-stage-1"
    );
    expect(thirdRequestBody.instances[0].personImage.image.bytesBase64Encoded).toBe(
      "result-stage-2"
    );
    expect(fourthRequestBody.instances[0].personImage.image.bytesBase64Encoded).toBe(
      "result-stage-3"
    );
  });

  it("classifies Vertex HTTP failures without losing the provider error code", async () => {
    vi.stubEnv("TRY_ON_PROVIDER", "vertex");
    vi.stubEnv("VERTEX_PROJECT_ID", "project-1");
    vi.stubEnv("VERTEX_LOCATION", "us-central1");
    vi.stubEnv("VERTEX_ACCESS_TOKEN", "access-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "upstream exploded"
      })
    );

    await expect(
      generateTryOnPreview({
        person_image: image,
        product_image: image,
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).rejects.toMatchObject({
      code: "vertex_http_error",
      statusHint: 503
    } satisfies Partial<TryOnProviderError>);
  });

  it("classifies output URI only responses as unsupported for the current inline flow", async () => {
    vi.stubEnv("TRY_ON_PROVIDER", "vertex");
    vi.stubEnv("VERTEX_PROJECT_ID", "project-1");
    vi.stubEnv("VERTEX_LOCATION", "us-central1");
    vi.stubEnv("VERTEX_ACCESS_TOKEN", "access-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          predictions: [
            {
              images: [
                {
                  mimeType: "image/png",
                  gcsUri: "gs://bucket/output.png"
                }
              ]
            }
          ]
        })
      })
    );

    await expect(
      generateTryOnPreview({
        person_image: image,
        product_image: image,
        prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
      })
    ).rejects.toMatchObject({
      code: "vertex_output_uri_only",
      statusHint: 502
    } satisfies Partial<TryOnProviderError>);
  });
});
