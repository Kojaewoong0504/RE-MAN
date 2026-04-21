import { beforeEach, describe, expect, it, vi } from "vitest";

const getDocMock = vi.fn();
const getDocsMock = vi.fn();

vi.mock("@/lib/firebase/client", () => ({
  getFirebaseFirestoreInstance: () => ({ app: "test-db" }),
  hasFirebaseClientConfig: () => true
}));

vi.mock("firebase/firestore", () => ({
  collection: (...segments: unknown[]) => ({
    kind: "collection",
    segments: segments.filter((segment): segment is string => typeof segment === "string")
  }),
  doc: (...segments: unknown[]) => ({
    kind: "doc",
    segments: segments.filter((segment): segment is string => typeof segment === "string")
  }),
  getDoc: getDocMock,
  getDocs: getDocsMock,
  serverTimestamp: vi.fn(() => "server-timestamp"),
  setDoc: vi.fn()
}));

function createDocSnapshot(data: Record<string, unknown> | null) {
  return {
    exists: () => data !== null,
    data: () => data
  };
}

function createQuerySnapshot(
  docs: Array<{ id: string; data: Record<string, unknown> }>
) {
  return {
    docs: docs.map((entry) => ({
      id: entry.id,
      data: () => entry.data
    }))
  };
}

describe("firebase firestore feedback parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDocMock.mockImplementation(async (ref: { segments: string[] }) => {
      if (ref.segments.join("/") === "users/user-1") {
        return createDocSnapshot({
          email: "user@example.com",
          survey: {
            current_style: "청바지 + 무지 티셔츠",
            motivation: "소개팅",
            budget: "15~30만원"
          }
        });
      }

      return createDocSnapshot(null);
    });
    getDocsMock.mockImplementation(async (ref: { segments: string[] }) => {
      const path = ref.segments.join("/");

      if (path === "users/user-1/feedbacks") {
        return createQuerySnapshot([]);
      }

      if (path === "users/user-1/deepDives") {
        return createQuerySnapshot([]);
      }

      return createQuerySnapshot([]);
    });
  });

  it("rejects malformed system recommendations instead of silently normalizing them", async () => {
    getDocsMock.mockImplementationOnce(async (ref: { segments: string[] }) => {
      const path = ref.segments.join("/");

      if (path === "users/user-1/feedbacks") {
        return createQuerySnapshot([
          {
            id: "1",
            data: {
              day: 1,
              diagnosis: "현재 스타일 진단",
              improvements: ["핏", "색", "신발"],
              recommended_outfit: {
                title: "기본 조합",
                items: ["검정 티셔츠", "청바지", "흰색 스니커즈"],
                reason: "지금 가진 옷으로 가능한 조합",
                try_on_prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
              },
              recommendation_mix: {
                primary_source: "system",
                closet_confidence: "low",
                system_support_needed: true,
                missing_categories: ["tops"],
                summary: "시스템 추천 필요"
              },
              system_recommendations: [
                {
                  id: "   ",
                  mode: "reference",
                  category: "tops",
                  title: "",
                  reason: "",
                  product: null
                }
              ],
              today_action: "옷장을 정리해보세요.",
              day1_mission: "오늘 조합을 다시 입어보세요."
            }
          }
        ]);
      }

      if (path === "users/user-1/deepDives") {
        return createQuerySnapshot([]);
      }

      return createQuerySnapshot([]);
    });

    const { readStyleProgramStateFromFirestore } = await import("@/lib/firebase/firestore");

    const state = await readStyleProgramStateFromFirestore("user-1");

    expect(state?.feedback).toBeUndefined();
  });

  it("preserves valid hybrid recommendation metadata from Firestore", async () => {
    getDocsMock.mockImplementationOnce(async (ref: { segments: string[] }) => {
      const path = ref.segments.join("/");

      if (path === "users/user-1/feedbacks") {
        return createQuerySnapshot([
          {
            id: "1",
            data: {
              day: 1,
              diagnosis: "현재 스타일 진단",
              improvements: ["핏", "색", "신발"],
              recommended_outfit: {
                title: "기본 조합",
                items: ["검정 티셔츠", "청바지", "흰색 스니커즈"],
                reason: "지금 가진 옷으로 가능한 조합",
                try_on_prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
              },
              recommendation_mix: {
                primary_source: "system",
                closet_confidence: "low",
                system_support_needed: true,
                missing_categories: ["tops"],
                summary: "시스템 추천 필요"
              },
              system_recommendations: [
                {
                  id: "sys-top-1",
                  mode: "reference",
                  category: "tops",
                  title: "네이비 셔츠",
                  color: "네이비",
                  fit: "레귤러",
                  season: ["봄", "가을"],
                  style_tags: ["clean"],
                  reason: "정돈된 인상",
                  image_url: "https://example.com/navy-shirt.jpg",
                  product: null
                }
              ],
              today_action: "옷장을 정리해보세요.",
              day1_mission: "오늘 조합을 다시 입어보세요."
            }
          }
        ]);
      }

      if (path === "users/user-1/deepDives") {
        return createQuerySnapshot([]);
      }

      return createQuerySnapshot([]);
    });

    const { readStyleProgramStateFromFirestore } = await import("@/lib/firebase/firestore");

    const state = await readStyleProgramStateFromFirestore("user-1");

    expect(state?.feedback?.recommendation_mix.primary_source).toBe("system");
    expect(state?.feedback?.system_recommendations).toEqual([
      {
        id: "sys-top-1",
        mode: "reference",
        category: "tops",
        title: "네이비 셔츠",
        color: "네이비",
        fit: "레귤러",
        season: ["봄", "가을"],
        style_tags: ["clean"],
        reason: "정돈된 인상",
        image_url: "https://example.com/navy-shirt.jpg",
        product: null
      }
    ]);
  });
});
