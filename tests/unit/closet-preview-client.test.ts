import { describe, expect, it } from "vitest";
import {
  buildClosetPreviewRequestKey,
  fetchClosetPreviewUrls
} from "@/lib/closet/preview-client";

describe("closet preview client", () => {
  it("builds a stable request key from storage-backed items only", () => {
    const requestKey = buildClosetPreviewRequestKey([
      {
        id: "local-top",
        category: "tops",
        name: "로컬 상의",
        photo_data_url: "data:image/png;base64,abc"
      },
      {
        id: "stored-shoes",
        category: "shoes",
        name: "저장된 신발",
        storage_bucket: "closet",
        storage_path: "user/shoes-1.jpg",
        image_url: "https://signed.example.com/shoes"
      },
      {
        id: "stored-bottom",
        category: "bottoms",
        name: "저장된 하의",
        storage_bucket: "closet",
        storage_path: "user/bottom-1.jpg"
      }
    ]);

    expect(requestKey).toBe(
      "stored-bottom:closet:user/bottom-1.jpg|stored-shoes:closet:user/shoes-1.jpg"
    );
  });

  it("skips the preview request when there are no storage-backed items", async () => {
    const fetchSpy = global.fetch;
    const mockFetch = globalThis.fetch = (() => {
      throw new Error("fetch should not be called");
    }) as typeof fetch;

    await expect(
      fetchClosetPreviewUrls([
        {
          id: "local-top",
          category: "tops",
          name: "로컬 상의",
          photo_data_url: "data:image/png;base64,abc"
        }
      ])
    ).resolves.toEqual({});

    globalThis.fetch = fetchSpy ?? mockFetch;
  });
});
