import { expect, test } from "@playwright/test";
import { SESSION_COOKIE_NAMES } from "../../lib/auth/constants";
import { issueSessionTokens } from "../../lib/auth/server";

const tinyPng = {
  name: "outfit.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s3FoX0AAAAASUVORK5CYII=",
    "base64"
  )
};

const invalidGif = {
  name: "outfit.gif",
  mimeType: "image/gif",
  buffer: Buffer.from("GIF89a")
};

async function selectClosetOptionalField(
  scope: import("@playwright/test").Page | import("@playwright/test").Locator,
  label: string,
  value: string
) {
  await scope
    .locator("label")
    .filter({ hasText: new RegExp(`^${label}`) })
    .locator("select")
    .selectOption(value);
}

async function fillClosetSnapshot(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await page.getByRole("button", { name: /한 벌 직접 등록/ }).click();
  await expect(page.locator("#closet-photo-upload")).toHaveAttribute("accept", "image/*");
  await expect(page.locator("#closet-photo-camera")).toHaveAttribute("accept", "image/*");
  await expect(page.locator("#closet-photo-camera")).toHaveAttribute("capture", "environment");
  await page.locator("#closet-photo-upload").setInputFiles(tinyPng);
  await page.getByLabel("종류").selectOption("tops");
  await page.getByRole("button", { name: /선택 정보/ }).click();
  await page.getByLabel("아이템 이름").fill("무지 티셔츠");
  await page.getByLabel("색").fill("흰색");
  await page.getByLabel("핏").fill("레귤러");
  await page.getByLabel("사이즈").fill("L");
  await page.getByLabel("착용감").selectOption("잘 맞음");
  await page.getByLabel("빈도").selectOption("자주 입음");
  await page.getByLabel("계절").selectOption("사계절");
  await selectClosetOptionalField(page, "상태", "깨끗함");
  await page.getByRole("button", { name: /사진을 옷장에 추가/ }).click();
  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await page.getByRole("button", { name: /한 벌 직접 등록/ }).click();
  await page.locator("#closet-photo-upload").setInputFiles(tinyPng);
  await page.getByLabel("종류").selectOption("bottoms");
  await page.getByRole("button", { name: /선택 정보/ }).click();
  await page.getByLabel("아이템 이름").fill("검정 슬랙스");
  await page.getByLabel("색").fill("검정");
  await page.getByLabel("사이즈").fill("32");
  await page.getByLabel("빈도").selectOption("거의 안 입음");
  await selectClosetOptionalField(page, "상태", "깨끗함");
  await page.getByRole("button", { name: /사진을 옷장에 추가/ }).click();
  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await page.getByRole("button", { name: /한 벌 직접 등록/ }).click();
  await page.locator("#closet-photo-upload").setInputFiles(tinyPng);
  await page.getByLabel("종류").selectOption("shoes");
  await page.getByRole("button", { name: /선택 정보/ }).click();
  await page.getByLabel("아이템 이름").fill("스니커즈");
  await page.getByLabel("색").fill("흰색");
  await page.getByLabel("사이즈").fill("270");
  await page.getByRole("button", { name: /사진을 옷장에 추가/ }).click();
}

async function fillUploadContext(page: import("@playwright/test").Page) {
  await fillClosetSnapshot(page);
}

const recommendedOutfit = {
  title: "기본 조합",
  items: ["상의", "하의", "신발"],
  reason: "지금 가진 옷으로 가능한 조합",
  try_on_prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
};

async function addTryOnSession(
  page: import("@playwright/test").Page,
  uid = "e2e-try-on-user"
) {
  process.env.AUTH_JWT_SECRET = "e2e-auth-secret";
  const { accessToken } = await issueSessionTokens(
    {
      uid,
      email: "try-on@example.com",
      name: "Try On User",
      picture: null,
      provider: "google"
    },
    "e2e-try-on-family",
    "e2e-try-on-token"
  );

  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAMES.access,
      value: accessToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

test("closet batch capture accepts multiple photos and creates review drafts", async ({ page }) => {
  await addTryOnSession(page, "e2e-closet-batch-user");
  await page.goto("/closet/batch");

  await expect(page.getByRole("heading", { name: "빠른 옷장 등록" })).toBeVisible();
  await expect(page.getByText("여러 장을 한 번에 추가하세요")).toBeVisible();
  await expect(page.getByText("사진 여러 장 선택")).toBeVisible();
  await expect(page.getByText("카메라로 한 장씩 추가")).toBeVisible();
});

test("closet editor exposes hat and bag categories", async ({ page }) => {
  await addTryOnSession(page, "e2e-closet-category-extension-user");
  await page.goto("/closet");

  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await page.getByRole("button", { name: /한 벌 직접 등록/ }).click();
  await page.getByLabel("종류").selectOption("hats");
  await expect(page.getByLabel("종류")).toHaveValue("hats");
  await page.getByLabel("종류").selectOption("bags");
  await expect(page.getByLabel("종류")).toHaveValue("bags");
});

test("closet batch analysis sends idempotency keys and skips reviewed drafts", async ({ page }) => {
  await addTryOnSession(page, "e2e-closet-batch-idempotency-user");
  const analyzeRequests: Array<{ idempotencyKey: string | null; body: unknown }> = [];

  await page.addInitScript(({ image }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {},
        closet_item_drafts: [
          {
            id: "draft-pending",
            photo_data_url: image,
            analysis_status: "pending"
          },
          {
            id: "draft-reviewed",
            photo_data_url: image,
            analysis_status: "needs_review",
            category: "tops",
            name: "이미 확인한 셔츠",
            analysis_confidence: 0.62,
            size_source: "unknown",
            size_confidence: 0
          }
        ]
      })
    );
  }, { image: `data:image/png;base64,${tinyPng.buffer.toString("base64")}` });

  await page.route("**/api/closet/analyze", async (route) => {
    analyzeRequests.push({
      idempotencyKey: route.request().headers()["idempotency-key"] ?? null,
      body: route.request().postDataJSON()
    });

    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        category: "tops",
        name: "분석된 셔츠",
        color: "네이비",
        detected_type: "셔츠",
        analysis_confidence: 0.8,
        size_source: "unknown",
        size_confidence: 0
      })
    });
  });

  await page.goto("/closet/batch");
  await page.getByRole("button", { name: "AI 초안 만들기" }).click();
  await expect(page).toHaveURL(/\/closet\/review$/);

  expect(analyzeRequests).toHaveLength(1);
  expect(analyzeRequests[0].idempotencyKey).toMatch(/^closet-analyze:batch-/);
  expect(analyzeRequests[0].body).toMatchObject({
    batch_session_id: expect.stringMatching(/^batch-/),
    draft_id: "draft-pending"
  });
});

test("closet batch shows progress summary for bulk capture", async ({ page }) => {
  await addTryOnSession(page, "e2e-closet-batch-summary-user");

  await page.addInitScript(({ image }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {},
        closet_item_drafts: [
          {
            id: "draft-pending",
            photo_data_url: image,
            analysis_status: "pending"
          },
          {
            id: "draft-review",
            photo_data_url: image,
            analysis_status: "needs_review",
            category: "tops",
            name: "셔츠"
          },
          {
            id: "draft-deleted",
            photo_data_url: image,
            analysis_status: "confirmed",
            deleted: true,
            category: "shoes",
            name: "삭제한 신발"
          }
        ]
      })
    );
  }, { image: `data:image/png;base64,${tinyPng.buffer.toString("base64")}` });

  await page.goto("/closet/batch");

  await expect(page.getByLabel("옷장 대량 등록 상태").getByText("선택됨")).toBeVisible();
  await expect(page.getByLabel("옷장 대량 등록 상태").getByText("3")).toBeVisible();
  await expect(page.getByLabel("옷장 대량 등록 상태").getByText("분석 대기")).toBeVisible();
  await expect(page.getByLabel("옷장 대량 등록 상태").getByText("확인 필요")).toBeVisible();
  await expect(page.getByLabel("옷장 대량 등록 상태").getByText("제외")).toBeVisible();
});

test("closet review saves confirmed drafts and ignores deleted drafts", async ({ page }) => {
  await addTryOnSession(page, "e2e-closet-review-user");
  const closetSyncRequests: unknown[] = [];

  await page.route("**/api/closet/items", async (route) => {
    const payload = route.request().postDataJSON();
    closetSyncRequests.push(payload);

    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        closet_items: payload.items.map((item: Record<string, unknown>) => ({
          ...item,
          photo_data_url: "",
          image_url: `https://storage.example.com/${item.id}.jpg`,
          storage_bucket: "uploads",
          storage_path: `closet/${item.id}.jpg`
        })),
        closet_profile: payload.closet_profile
      })
    });
  });

  await page.goto("/closet/review");

  await page.evaluate(() => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {},
        closet_item_drafts: [
          {
            id: "draft-top",
            photo_data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
            analysis_status: "confirmed",
            category: "tops",
            name: "네이비 셔츠",
            color: "네이비",
            analysis_confidence: 0.82,
            size_source: "unknown",
            size_confidence: 0
          },
          {
            id: "draft-bottom",
            photo_data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
            analysis_status: "needs_review",
            category: "bottoms",
            name: "청바지",
            color: "블루",
            analysis_confidence: 0.52,
            size_source: "unknown",
            size_confidence: 0
          },
          {
            id: "draft-shoes",
            photo_data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
            analysis_status: "confirmed",
            category: "shoes",
            name: "흰색 스니커즈",
            color: "흰색",
            analysis_confidence: 0.8,
            size_source: "unknown",
            size_confidence: 0
          }
        ]
      })
    );
  });
  await page.reload();

  await page.getByRole("button", { name: "청바지 수정" }).click();
  await page.getByRole("textbox", { name: "이름", exact: true }).fill("연청 데님");
  await page.getByRole("button", { name: "수정 저장" }).click();
  await page.getByRole("button", { name: "흰색 스니커즈 삭제" }).click();
  await page.getByRole("button", { name: "옷장에 저장" }).click();

  await expect(page).toHaveURL(/\/closet\?from=review&saved=2$/);
  await page.getByRole("button", { name: /상의/ }).click();
  await expect(page.getByText("네이비 셔츠")).toBeVisible();
  await page.getByRole("button", { name: /하의/ }).click();
  await expect(page.getByText("연청 데님")).toBeVisible();
  await expect(page.getByText("흰색 스니커즈")).toHaveCount(0);

  expect(closetSyncRequests).toHaveLength(1);
  expect(closetSyncRequests[0]).toMatchObject({
    items: [
      expect.objectContaining({
        id: "closet-draft-top",
        category: "tops",
        name: "네이비 셔츠"
      }),
      expect.objectContaining({
        id: "closet-draft-bottom",
        category: "bottoms",
        name: "연청 데님"
      })
    ]
  });

  const savedState = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("reman:onboarding") ?? "{}")
  );

  expect(savedState.closet_items[0].photo_data_url).toBe("");
  expect(savedState.closet_items[0].image_url).toBe(
    "https://storage.example.com/closet-draft-top.jpg"
  );
});

test("closet item click opens action modal and edit modal exposes explicit save controls", async ({
  page
}) => {
  await addTryOnSession(page, "e2e-closet-item-actions-user");

  await page.addInitScript(({ image }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {},
        closet_items: [
          {
            id: "closet-top-1",
            category: "tops",
            name: "블랙 그래픽 티셔츠",
            photo_data_url: image,
            color: "블랙",
            fit: "오버핏",
            size: "2XL",
            wear_frequency: "자주 입음",
            season: "여름",
            condition: "사용감 있음",
            notes: "AI 초안: 티셔츠"
          }
        ]
      })
    );
  }, { image: `data:image/png;base64,${tinyPng.buffer.toString("base64")}` });

  await page.goto("/closet?from=review&saved=1");
  await page.getByRole("button", { name: /상의 행거 · 1/ }).click();
  await page.getByRole("button", { name: /블랙 그래픽 티셔츠/ }).click();

  const actionDialog = page.getByRole("dialog", { name: "옷 선택 행동" });
  await expect(actionDialog).toBeVisible();
  await expect(actionDialog.getByRole("button", { name: "수정" })).toBeVisible();
  await expect(actionDialog.getByRole("button", { name: "삭제" })).toBeVisible();

  await actionDialog.getByRole("button", { name: "수정" }).click();

  const editDialog = page.getByRole("dialog", { name: "옷 수정" });
  await expect(editDialog).toBeVisible();
  await expect(editDialog.getByRole("button", { name: "수정 저장" })).toBeVisible();
  await expect(editDialog.getByRole("button", { name: "선택 정보 펼치기" })).toBeVisible();

  await editDialog.getByRole("button", { name: "선택 정보 펼치기" }).click();
  await expect(editDialog.getByRole("button", { name: "선택 정보 접기" })).toBeVisible();
});

test("closet review shows saveable and review summary", async ({ page }) => {
  await addTryOnSession(page, "e2e-closet-review-summary-user");

  await page.addInitScript(({ image }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {},
        closet_item_drafts: [
          {
            id: "draft-saveable",
            photo_data_url: image,
            analysis_status: "confirmed",
            category: "tops",
            name: "저장할 셔츠",
            analysis_confidence: 0.86
          },
          {
            id: "draft-review",
            photo_data_url: image,
            analysis_status: "needs_review",
            category: "bottoms",
            name: "확인할 바지"
          },
          {
            id: "draft-deleted",
            photo_data_url: image,
            analysis_status: "confirmed",
            deleted: true,
            category: "shoes",
            name: "제외한 신발",
            analysis_confidence: 0.9
          }
        ]
      })
    );
  }, { image: `data:image/png;base64,${tinyPng.buffer.toString("base64")}` });

  await page.goto("/closet/review");

  await expect(page.getByLabel("옷장 저장 검토 상태").getByText("저장 가능")).toBeVisible();
  await expect(page.getByLabel("옷장 저장 검토 상태").getByText("확인 필요")).toBeVisible();
  await expect(page.getByLabel("옷장 저장 검토 상태").getByText("제외")).toBeVisible();
});

test("closet review filters drafts by review status", async ({ page }) => {
  await addTryOnSession(page, "e2e-closet-review-filter-user");

  await page.addInitScript(({ image }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {},
        closet_item_drafts: [
          {
            id: "draft-saveable",
            photo_data_url: image,
            analysis_status: "confirmed",
            category: "tops",
            name: "저장할 셔츠",
            analysis_confidence: 0.86
          },
          {
            id: "draft-review",
            photo_data_url: image,
            analysis_status: "needs_review",
            category: "bottoms",
            name: "확인할 바지"
          },
          {
            id: "draft-deleted",
            photo_data_url: image,
            analysis_status: "confirmed",
            deleted: true,
            category: "shoes",
            name: "제외한 신발",
            analysis_confidence: 0.9
          }
        ]
      })
    );
  }, { image: `data:image/png;base64,${tinyPng.buffer.toString("base64")}` });

  await page.goto("/closet/review");

  await expect(page.getByRole("heading", { name: "저장할 셔츠" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "확인할 바지" })).toBeVisible();
  await expect(page.getByRole("button", { name: "전체 2" })).toBeVisible();
  await expect(page.getByRole("button", { name: "확인 필요만 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "저장 가능만 1" })).toBeVisible();

  await page.getByRole("button", { name: "확인 필요만 1" }).click();
  await expect(page.getByRole("heading", { name: "저장할 셔츠" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "확인할 바지" })).toBeVisible();

  await page.getByRole("button", { name: "저장 가능만 1" }).click();
  await expect(page.getByRole("heading", { name: "저장할 셔츠" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "확인할 바지" })).toHaveCount(0);

  await page.getByRole("button", { name: "전체 2" }).click();
  await expect(page.getByRole("heading", { name: "저장할 셔츠" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "확인할 바지" })).toBeVisible();
});

test("closet review can quick confirm needs-review drafts", async ({ page }) => {
  await addTryOnSession(page, "e2e-closet-review-quick-confirm-user");

  await page.addInitScript(({ image }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {},
        closet_item_drafts: [
          {
            id: "draft-saveable",
            photo_data_url: image,
            analysis_status: "confirmed",
            category: "tops",
            name: "저장할 셔츠",
            analysis_confidence: 0.86
          },
          {
            id: "draft-review",
            photo_data_url: image,
            analysis_status: "needs_review",
            category: "bottoms",
            name: "확인할 바지"
          }
        ]
      })
    );
  }, { image: `data:image/png;base64,${tinyPng.buffer.toString("base64")}` });

  await page.goto("/closet/review");
  await page.getByRole("button", { name: "확인 필요만 1" }).click();
  await page.getByLabel("확인할 바지 빠른 이름").fill("연청 데님");
  await page.getByRole("button", { name: "연청 데님 확정" }).click();

  await expect(page.getByRole("button", { name: "확인 필요만 0" })).toBeVisible();
  await expect(page.getByRole("button", { name: "저장 가능만 2" })).toBeVisible();

  await page.getByRole("button", { name: "저장 가능만 2" }).click();
  await expect(page.getByRole("heading", { name: "저장할 셔츠" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "연청 데님" })).toBeVisible();
});

test("closet review can confirm draft categories without opening text edit", async ({ page }) => {
  await addTryOnSession(page, "e2e-closet-review-category-user");
  const closetSyncRequests: unknown[] = [];

  await page.route("**/api/closet/items", async (route) => {
    const payload = route.request().postDataJSON();
    closetSyncRequests.push(payload);

    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        closet_items: payload.items,
        closet_profile: payload.closet_profile
      })
    });
  });

  await page.addInitScript(({ image }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {},
        closet_item_drafts: [
          {
            id: "draft-quick-bottom",
            photo_data_url: image,
            analysis_status: "needs_review",
            detected_type: "바지",
            analysis_confidence: 0.44,
            size_source: "unknown",
            size_confidence: 0
          }
        ]
      })
    );
  }, { image: `data:image/png;base64,${tinyPng.buffer.toString("base64")}` });

  await page.goto("/closet/review");
  await page.getByRole("button", { name: "하의로 분류" }).click();
  await expect(page.getByText("하의 사진")).toBeVisible();
  await expect(page.getByRole("button", { name: "옷장에 저장" })).toBeEnabled();
  await page.getByRole("button", { name: "옷장에 저장" }).click();

  expect(closetSyncRequests).toHaveLength(1);
  expect(closetSyncRequests[0]).toMatchObject({
    items: [
      expect.objectContaining({
        id: "closet-draft-quick-bottom",
        category: "bottoms",
        name: "하의 사진"
      })
    ]
  });
});

test("closet review save shows readiness and continues into style check", async ({ page }) => {
  await addTryOnSession(page, "e2e-closet-review-ready-user");

  await page.route("**/api/closet/items", async (route) => {
    const payload = route.request().postDataJSON();

    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        closet_items: payload.items.map((item: Record<string, unknown>) => ({
          ...item,
          photo_data_url: "",
          image_url: "",
          storage_bucket: "uploads",
          storage_path: `closet/${String(item.id)}.jpg`
        })),
        closet_profile: payload.closet_profile
      })
    });
  });

  await page.addInitScript(({ image }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원"
        },
        closet_item_drafts: [
          {
            id: "draft-ready-top",
            photo_data_url: image,
            analysis_status: "confirmed",
            category: "tops",
            name: "네이비 셔츠",
            analysis_confidence: 0.82,
            size_source: "unknown",
            size_confidence: 0
          },
          {
            id: "draft-ready-bottom",
            photo_data_url: image,
            analysis_status: "confirmed",
            category: "bottoms",
            name: "검정 슬랙스",
            analysis_confidence: 0.82,
            size_source: "unknown",
            size_confidence: 0
          },
          {
            id: "draft-ready-shoes",
            photo_data_url: image,
            analysis_status: "confirmed",
            category: "shoes",
            name: "흰색 스니커즈",
            analysis_confidence: 0.82,
            size_source: "unknown",
            size_confidence: 0
          }
        ]
      })
    );
  }, { image: `data:image/png;base64,${tinyPng.buffer.toString("base64")}` });

  await page.goto("/closet/review");
  await page.getByRole("button", { name: "옷장에 저장" }).click();
  await expect(page).toHaveURL(/\/closet\?from=review/);
  await expect(page.getByRole("region", { name: "옷장 저장 결과" })).toBeVisible();
  await expect(page.getByText("3벌 저장됨")).toBeVisible();
  await expect(page.getByText("스타일 체크 준비 완료")).toBeVisible();
  await page.getByRole("button", { name: "이 옷장으로 스타일 체크" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/upload$/);
  await expect(
    page.getByRole("region", { name: "분석 준비 상태" }).getByText("상의, 하의, 신발 준비됨")
  ).toBeVisible();
});

test("closet page renders signed preview for saved storage items", async ({ page }) => {
  await addTryOnSession(page, "e2e-closet-preview-user");
  let previewRequestCount = 0;

  await page.route("**/api/closet/previews", async (route) => {
    previewRequestCount += 1;
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        previews: [
          {
            id: "saved-top",
            preview_url: "https://signed.example.com/saved-top.jpg"
          }
        ]
      })
    });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        user_id: "e2e-closet-preview-user",
        email: "try-on@example.com",
        survey: {},
        closet_items: [
          {
            id: "saved-top",
            category: "tops",
            name: "네이비 셔츠",
            photo_data_url: "",
            image_url: "",
            storage_bucket: "uploads",
            storage_path: "closet/saved-top.jpg"
          }
        ],
        closet_profile: {
          tops: "네이비 셔츠",
          bottoms: "",
          shoes: "",
          outerwear: "",
          avoid: ""
        }
      })
    );
  });

  await page.goto("/closet");
  await expect(page.getByRole("heading", { name: "옷장 사진 저장" })).toBeVisible();
  await expect.poll(() => previewRequestCount).toBeGreaterThan(0);
  await page.getByRole("button", { name: /상의 .* 열기/ }).click();
  await expect(page.getByAltText("네이비 셔츠 옷장 사진")).toHaveAttribute(
    "src",
    /signed\.example\.com\/saved-top\.jpg/
  );
});

test("closet add button opens batch-first mode chooser", async ({ page }) => {
  await addTryOnSession(page, "e2e-closet-mode-user");
  await page.goto("/closet");

  await page.getByLabel("옷 추가").click();
  await expect(page.getByText("빠른 촬영")).toBeVisible();
  await expect(page.getByText("한 벌 직접 등록")).toBeVisible();
});

test("style upload exposes gallery and camera inputs on mobile", async ({ page }) => {
  await addTryOnSession(page, "e2e-style-mobile-camera-user");
  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();

  await expect(page.locator("#photo-upload")).toHaveAttribute("accept", "image/*");
  await expect(page.locator("#photo-camera")).toHaveAttribute("accept", "image/*");
  await expect(page.locator("#photo-camera")).toHaveAttribute("capture", "environment");
});

test("onboarding flow captures input and renders feedback", async ({ page }) => {
  await addTryOnSession(page, "e2e-feedback-flow-user");
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "관리 홈" })
  ).toBeVisible();

  await page.getByRole("link", { name: "스타일 체크 시작 →" }).click();
  await expect(page).toHaveURL(/\/programs\/style$/);
  await expect(page.getByText("체크 3회")).toBeVisible();
  await page
    .getByRole("region", { name: "스타일 체크 다음 행동" })
    .getByRole("link", { name: "옷장 채우기" })
    .click();
  await expect(page).toHaveURL(/\/closet$/);
  await fillClosetSnapshot(page);
  await page.getByRole("button", { name: "이 옷장으로 스타일 체크" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/survey$/);
  await expect(
    page.getByRole("heading", { name: "지금 스타일이 어때요?" })
  ).toBeVisible();
  const viewport = page.viewportSize();
  const surveyCta = page.getByRole("button", { name: "사진 업로드로 이동" });

  await expect(surveyCta).toBeVisible();

  const initialBox = await surveyCta.boundingBox();

  expect(initialBox).not.toBeNull();
  expect(viewport).not.toBeNull();

  if (initialBox && viewport) {
    expect(initialBox.y).toBeGreaterThan(viewport.height - 180);
    expect(initialBox.y + initialBox.height).toBeLessThanOrEqual(viewport.height - 12);
  }

  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await surveyCta.click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/upload$/);
  await expect(
    page.getByRole("heading", { name: "사진이 기준입니다" })
  ).toBeVisible();

  await page.locator("#photo-upload").setInputFiles(tinyPng);

  const onboardingResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/feedback") && response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "AI 분석 시작하기" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/(analyzing|result)$/);

  const onboardingResponse = await onboardingResponsePromise;
  expect(onboardingResponse.ok()).toBeTruthy();
  expect(onboardingResponse.request().headers()["idempotency-key"]).toMatch(
    /^style-feedback:/
  );
  const onboardingPayload = onboardingResponse.request().postDataJSON();
  expect(typeof onboardingPayload.image).toBe("string");
  expect(onboardingPayload.image.startsWith("data:image/jpeg;base64,")).toBeTruthy();
  expect(onboardingPayload.closet_profile.tops).toContain("흰색 무지 티셔츠");
  expect(onboardingPayload.closet_profile.tops).toContain("[L]");
  expect(onboardingPayload.closet_profile.tops).toContain("{잘 맞음}");
  expect(onboardingPayload.closet_profile.tops).toContain("빈도:자주 입음");
  expect(onboardingPayload.closet_profile.tops).toContain("계절:사계절");
  expect(onboardingPayload.closet_profile.tops).toContain("상태:깨끗함");
  expect(onboardingPayload.closet_items[0].wear_frequency).toBe("자주 입음");
  expect(onboardingPayload.closet_items[0].season).toBe("사계절");
  expect(onboardingPayload.closet_items[0].condition).toBe("깨끗함");
  expect(onboardingPayload.closet_items[0]).not.toHaveProperty("photo_data_url");
  expect(onboardingPayload.closet_strategy).toMatchObject({
    core_item_ids: expect.arrayContaining([onboardingPayload.closet_items[0].id]),
    optional_item_ids: expect.arrayContaining([onboardingPayload.closet_items[1].id]),
    items: expect.arrayContaining([
      expect.objectContaining({
        id: onboardingPayload.closet_items[0].id,
        role: "core",
        score: expect.any(Number)
      }),
      expect.objectContaining({
        id: onboardingPayload.closet_items[1].id,
        role: "optional",
        score: expect.any(Number)
      })
    ])
  });
  expect(onboardingPayload.survey.style_goal).toBe("전체적인 스타일 리셋");
  expect(onboardingPayload.survey.confidence_level).toBe("배우는 중");

  await page.waitForURL(/\/programs\/style\/onboarding\/result$/);
  await expect(
    page.getByRole("heading", { name: "오늘 조합" })
  ).toBeVisible();
  await expect(page.getByText("체크 2회")).toBeVisible();
  await expect(page.getByRole("heading", { name: "내 옷장 기준" })).toBeVisible();
  const resultBasisRegion = page.getByRole("region", { name: "내 옷장 기준" });
  await expect(resultBasisRegion).toBeVisible();
  await expect(page.getByText(/상의 · 하의 · 신발 중 \d개 반영/)).toBeVisible();
  await expect(page.getByText(/흰색 무지 티셔츠 중심으로 시작/)).toBeVisible();
  await expect(resultBasisRegion.getByRole("heading", { name: "흰색 무지 티셔츠" })).toBeVisible();
  await expect(resultBasisRegion.getByText("추천에 사용").first()).toBeVisible();
  await expect(resultBasisRegion.getByText("옷장 ID 검증").first()).toBeVisible();
  await expect(page.getByText("자주 입고 잘 맞음").first()).toHaveCount(0);
  await expect(page.getByRole("link", { name: "크레딧 확인" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /핏 더 보기/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /레퍼런스\/실착 보기/ })).toHaveCount(0);
  await expect(page.getByText("청바지 + 무지 티셔츠 중심의 코디라")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "지금 가진 옷으로 만드는 깔끔한 기본 조합" })
  ).toBeVisible();
  await expect(page.getByText("오늘 실행 3단계")).toBeVisible();
  const todayActionBox = await page.getByText("오늘 실행 3단계").boundingBox();
  const closetBasisBox = await page
    .getByRole("heading", { name: "내 옷장 기준" })
    .boundingBox();
  expect(todayActionBox).not.toBeNull();
  expect(closetBasisBox).not.toBeNull();
  if (todayActionBox && closetBasisBox) {
    expect(todayActionBox.y).toBeLessThan(closetBasisBox.y);
  }
  await expect(page.getByText("추천 상의 꺼내기")).toBeVisible();
  await expect(page.getByText("하의와 신발 같이 입기")).toBeVisible();
  await expect(page.getByText("거울 앞에서 사진 비교하기")).toBeVisible();
  await expect(page.getByRole("button", { name: /진단과 이유 보기/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /근거 자세히 보기/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /바꿀 점 3개 보기/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /조합 느낌 보기/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /사이즈 후보 보기/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /계정 저장 열기/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "사이즈 체크 후보" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "이 추천이 도움이 됐나요?" })).toBeVisible();
  await page.getByRole("button", { name: /도움됨/ }).click();
  await page.getByPlaceholder("예: 셔츠 조합은 좋은데 신발은 애매했어요.").fill("셔츠 방향이 좋았어요.");
  await page.getByRole("button", { name: "추천 반응 저장" }).click();
  await expect(page.getByRole("button", { name: /도움됨 저장됨/ })).toBeVisible();
  await expect(page.getByText("다음 스타일 체크에 이 반응을 함께 반영합니다.")).toBeVisible();
  const resultMemory = page.locator(".feedback-memory-summary").first();
  await expect(resultMemory.getByText("다음 추천 기준", { exact: true })).toBeVisible();
  await expect(resultMemory.getByText("좋아한 방향")).toBeVisible();
  await expect(resultMemory.getByText("지금 가진 옷으로 만드는 깔끔한 기본 조합")).toBeVisible();
  await expect(resultMemory.getByText("메모")).toBeVisible();
  const recommendationFeedbackState = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("reman:onboarding") ?? "{}")
  );
  expect(recommendationFeedbackState.recommendation_feedback.reaction).toBe("helpful");
  expect(recommendationFeedbackState.recommendation_feedback.note).toContain("셔츠 방향");
  expect(recommendationFeedbackState.feedback_history[0].summary).toContain("내 반응: 도움됨");
  expect(recommendationFeedbackState.feedback_history[0].summary).toContain("셔츠 방향");
  const nextStep = page.getByLabel("스타일 체크 다음 단계");
  await expect(nextStep.getByRole("link", { name: "기록에서 보기" })).toBeVisible();
  await expect(nextStep.getByRole("button", { name: "새 체크" })).toBeVisible();
  await expect(page.getByText(/^provider:/)).toHaveCount(0);
  await expect(page.getByText(/^개발 설정 누락:/)).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "오늘 조합" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "원하면 루틴 모드로 이어가기" })).toHaveCount(0);
  await page.getByLabel("주요 메뉴").getByRole("link", { name: "홈" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "관리 홈" })
  ).toBeVisible();
  await expect(page.getByText("최근 결과가 있습니다.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "기록 보기" })).toHaveCount(0);
});

test("upload step rejects unsupported photos and requires useful text fallback", async ({ page }) => {
  await addTryOnSession(page);
  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();

  await page.locator("#photo-upload").setInputFiles(invalidGif);
  await expect(
    page.getByText("모바일 사진 앱의 이미지 파일만 업로드할 수 있습니다.")
  ).toBeVisible();

  await page.getByRole("button", { name: "사진 없이 옷 설명으로 진행하기" }).click();
  await fillUploadContext(page);
  await page.getByLabel("오늘 입은 옷 설명").fill("짧음");
  await expect(page.getByText("현재 2자입니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 분석 시작하기" })).toBeDisabled();

  await page.getByLabel("오늘 입은 옷 설명").fill("검정 후드티와 청바지를 입었어요");
  await expect(page.getByRole("button", { name: "AI 분석 시작하기" })).toBeEnabled();
});

test("upload step summarizes analysis readiness in one status card", async ({ page }) => {
  await addTryOnSession(page, "e2e-upload-readiness-user");
  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();

  const readiness = page.getByRole("region", { name: "분석 준비 상태" });
  await expect(readiness).toBeVisible();
  await expect(readiness.getByRole("heading", { name: "사진과 옷장 필요" })).toBeVisible();
  await expect(readiness.getByText("사진 필요")).toBeVisible();
  await expect(readiness.getByText("상의, 하의, 신발 필요")).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 분석 시작하기" })).toBeDisabled();

  await page.locator("#photo-upload").setInputFiles(tinyPng);
  await fillUploadContext(page);

  await expect(readiness.getByRole("heading", { name: "분석 가능" })).toBeVisible();
  await expect(readiness.getByText("사진 준비됨")).toBeVisible();
  await expect(readiness.getByText("상의, 하의, 신발 준비됨")).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 분석 시작하기" })).toBeEnabled();
});

test("upload step uses the sartorial slate photo frame", async ({ page }) => {
  await addTryOnSession(page, "e2e-upload-design-user");
  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();

  const frame = page.getByTestId("photo-preview-frame");

  await expect(frame).toHaveAttribute("data-design-system", "sartorial-slate");
  await expect(frame).toContainText("지금 입은 모습 그대로");
});

test("analyzing page advances monotonically without resetting completed stages", async ({ page }) => {
  await addTryOnSession(page, "e2e-analyzing-motion-user");
  await page.route("**/api/feedback", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 7800));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        diagnosis: "현재 스타일 진단",
        improvements: ["개선 1", "개선 2", "개선 3"],
        recommended_outfit: recommendedOutfit,
        recommendation_mix: {
          primary_source: "closet",
          closet_confidence: "high",
          system_support_needed: false,
          missing_categories: [],
          summary: "옷장 기준으로 정리합니다."
        },
        system_recommendations: [],
        today_action: "오늘 바로 할 것",
        day1_mission: "오늘 미션"
      })
    });
  });

  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();
  await page.locator("#photo-upload").setInputFiles(tinyPng);
  await fillUploadContext(page);
  await page.getByRole("button", { name: "AI 분석 시작하기" }).click();

  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/analyzing$/);

  const currentStage = page.getByTestId("analysis-stage-current");
  const timeline = page.getByTestId("analysis-stage-timeline");
  const stageItems = timeline.locator(".analysis-stage-item");

  await expect(currentStage).toHaveAttribute("data-stage-index", "0");
  await expect(timeline.getByRole("listitem")).toHaveCount(3);
  await expect
    .poll(async () => currentStage.getAttribute("data-stage-index"), {
      timeout: 2600
    })
    .toBe("1");
  await expect(stageItems.nth(0).locator(".analysis-stage-state")).toHaveText("완료");
  await expect(stageItems.nth(1).locator(".analysis-stage-state")).toHaveText("진행 중");

  await expect
    .poll(async () => currentStage.getAttribute("data-stage-index"), {
      timeout: 4000
    })
    .toBe("1");
  await expect(stageItems.nth(0).locator(".analysis-stage-state")).toHaveText("완료");
  await expect(stageItems.nth(1).locator(".analysis-stage-state")).toHaveText("진행 중");
  await expect(stageItems.nth(2).locator(".analysis-stage-state")).toHaveText("대기");
  await page.waitForTimeout(1500);
  await expect(stageItems.nth(0).locator(".analysis-stage-state")).toHaveText("완료");
  await expect(stageItems.nth(1).locator(".analysis-stage-state")).toHaveText("진행 중");
  await expect(stageItems.nth(2).locator(".analysis-stage-state")).toHaveText("대기");
});

test("result action hub can start a new style check", async ({ page }) => {
  const uploadedImage = `data:image/png;base64,${tinyPng.buffer.toString("base64")}`;

  await page.addInitScript(({ outfit, uploadedImage }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_profile: {
          tops: "무지 티셔츠",
          bottoms: "청바지",
          shoes: "흰색 스니커즈"
        },
        image: uploadedImage,
        feedback: {
          diagnosis: "기존 스타일 체크 결과",
          improvements: ["a", "b", "c"],
          recommended_outfit: outfit,
          recommendation_mix: {
            primary_source: "closet",
            closet_confidence: "high",
            system_support_needed: false,
            missing_categories: [],
            summary: "주 조합은 옷장 기준으로 구성합니다."
          },
          system_recommendations: [],
          today_action: "오늘 바로 할 것",
          day1_mission: "루틴 미션"
        },
        feedback_history: [{ day: 1, summary: "긴 기록" }]
      })
    );
  }, { outfit: recommendedOutfit, uploadedImage });

  await addTryOnSession(page);
  await page.goto("/programs/style/onboarding/result");
  await page.getByRole("button", { name: "새 체크" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/upload$/);
  await expect(page.getByRole("heading", { name: "사진이 기준입니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 분석 시작하기" })).toBeDisabled();
});

test("saved result uses try-on modal with system source by default and viewer modal", async ({ page }) => {
  let deepDiveRequests = 0;
  const tryOnRequests: Array<Record<string, unknown>> = [];
  const uploadedImage = `data:image/png;base64,${tinyPng.buffer.toString("base64")}`;
  let releaseTryOn: () => void = () => {
    throw new Error("try-on route was not intercepted");
  };
  let tryOnIntercepted = false;

  await page.route("**/api/deep-dive", async (route) => {
    deepDiveRequests += 1;
    await route.abort();
  });
  await page.route("**/api/try-on", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    tryOnRequests.push(body);
    await new Promise<void>((resolve) => {
      releaseTryOn = () => {
        tryOnIntercepted = true;
        resolve();
      };
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "vertex",
        preview_image: uploadedImage,
        message: "실착 생성 완료",
        credits_remaining: 2,
        credits_charged: 1,
        review_required: true,
        review_reason: "레이어드 상의 / 신발 포함 조합",
        stage_previews: [
          {
            step: 1,
            preview_image: uploadedImage,
            label: "화이트 셔츠",
            retry_attempted: true,
            auto_corrected: true,
            correction_failed: false
          },
          {
            step: 2,
            preview_image: uploadedImage,
            label: "블랙 블레이저"
          },
          {
            step: 3,
            preview_image: uploadedImage,
            label: "검정 슬랙스"
          }
        ],
        idempotent_replay: false,
        credit_reference_id: "try-on-credit-1"
      })
    });
  });
  await page.addInitScript(({ outfit, uploadedImage }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_profile: {
          tops: "무지 티셔츠",
          bottoms: "청바지",
          shoes: "흰색 스니커즈"
        },
        closet_items: [
          {
            id: "size-top",
            category: "tops",
            name: "옥스포드 셔츠",
            color: "네이비",
            size: "L",
            wear_state: "잘 맞음",
            condition: "깨끗함",
            photo_data_url: uploadedImage
          },
          {
            id: "size-bottom",
            category: "bottoms",
            name: "검정 슬랙스",
            color: "검정",
            size: "32",
            wear_state: "잘 맞음",
            condition: "깨끗함",
            photo_data_url: uploadedImage
          },
          {
            id: "size-shoes",
            category: "shoes",
            name: "흰색 스니커즈",
            color: "흰색",
            size: "270",
            wear_state: "보통",
            condition: "깨끗함",
            photo_data_url: uploadedImage
          }
        ],
        size_profile: {
          top_size: "L",
          bottom_size: "32",
          shoe_size_mm: "270",
          fit_preference: "너무 붙지 않게"
        },
        feedback: {
          diagnosis: "저장된 스타일 체크 진단",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: {
            ...outfit,
            source_item_ids: {
              tops: "size-top",
              bottoms: "size-bottom",
              shoes: "size-shoes"
            }
          },
          recommendation_mix: {
            primary_source: "closet",
            closet_confidence: "medium",
            system_support_needed: true,
            missing_categories: ["bottoms", "shoes"],
            summary: "옷장 기준 조합을 먼저 보고 부족한 카테고리는 시스템 추천으로 보강합니다."
          },
          system_recommendations: [
            {
              id: "sys-top-1",
              mode: "reference",
              category: "tops",
              title: "하늘색 옥스퍼드 셔츠",
              color: "하늘색",
              fit: "레귤러",
              reason: "얼굴 주변을 정리합니다.",
              image_url: uploadedImage,
              product: null
            },
            {
              id: "sys-bottom-1",
              mode: "reference",
              category: "bottoms",
              title: "검정 테이퍼드 슬랙스",
              color: "검정",
              fit: "테이퍼드",
              reason: "실루엣을 정리합니다.",
              image_url: uploadedImage,
              product: null
            },
            {
              id: "sys-shoes-1",
              mode: "reference",
              category: "shoes",
              title: "화이트 미니멀 스니커즈",
              color: "화이트",
              fit: "로우탑",
              reason: "무게를 가볍게 정리합니다.",
              image_url: uploadedImage,
              product: null
            }
          ],
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        }
      })
    );
  }, { outfit: recommendedOutfit, uploadedImage });

  await addTryOnSession(page);
  await page.goto("/programs/style/onboarding/result");
  await expect(
    page.getByRole("heading", { name: "오늘 조합" })
  ).toBeVisible();
  await expect(page.getByText("체크 3회")).toBeVisible();
  await expect(page.getByRole("img", { name: /추천 상의/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /추천 하의/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /추천 신발/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /시스템 추천 tops/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /색 조합 보기/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /핏 더 보기/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /크레딧 확인/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "실착 이미지 만들기" })).toBeVisible();
  await page.getByRole("button", { name: "실착 이미지 만들기" }).click();
  const tryOnSetupDialog = page.getByRole("dialog", { name: "실착 생성 설정" });
  await expect(tryOnSetupDialog).toBeVisible();
  await expect(tryOnSetupDialog).toContainText("시스템 추천 조합");
  await expect(page.getByRole("button", { name: "시스템 추천 조합" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(
    tryOnSetupDialog.getByText("선택 3개 · 예상 1 pass · 크레딧 1")
  ).toBeVisible();
  const setupBackdropMetrics = await page.locator(".result-modal-backdrop").evaluate((element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      position: style.position,
      top: style.top,
      left: style.left,
      rectHeight: rect.height,
      viewportHeight: window.innerHeight
    };
  });
  expect(setupBackdropMetrics.position).toBe("fixed");
  expect(setupBackdropMetrics.top).toBe("0px");
  expect(setupBackdropMetrics.left).toBe("0px");
  expect(setupBackdropMetrics.rectHeight).toBeGreaterThanOrEqual(
    setupBackdropMetrics.viewportHeight - 24
  );
  const tryOnStartButton = page
    .getByRole("dialog", { name: "실착 생성 설정" })
    .getByRole("button", { name: "실착 생성 시작" });
  await tryOnStartButton.scrollIntoViewIfNeeded();
  await tryOnStartButton.click();
  await expect(page.getByRole("dialog", { name: "실착 생성 중" })).toBeVisible();
  await expect(page.getByRole("button", { name: "실착 생성 시작" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "새 체크" })).toBeDisabled();
  if (!tryOnIntercepted && tryOnRequests.length === 0) {
    throw new Error("try-on route was not intercepted");
  }
  releaseTryOn();
  await expect(page.getByRole("dialog", { name: "실착 결과 보기" })).toBeVisible();
  await expect(page.getByText("체크 2회")).toBeVisible();
  const tryOnViewerDialog = page.getByRole("dialog", { name: "실착 결과 보기" });
  await expect(tryOnViewerDialog.getByRole("img", { name: "실착 결과 전체 보기" })).toBeVisible();
  await expect(tryOnViewerDialog.getByText("합성 단계")).toBeVisible();
  await expect(tryOnViewerDialog.getByText("검토 필요")).toBeVisible();
  await expect(tryOnViewerDialog.getByText("레이어드 상의 / 신발 포함 조합")).toBeVisible();
  await expect(tryOnViewerDialog.getByText("1단계", { exact: true })).toBeVisible();
  await expect(tryOnViewerDialog.getByText("2단계", { exact: true })).toBeVisible();
  await expect(tryOnViewerDialog.getByText("3단계", { exact: true })).toBeVisible();
  await expect(tryOnViewerDialog.getByText("자동 보정됨")).toBeVisible();
  expect(tryOnRequests).toHaveLength(1);
  expect(tryOnRequests[0]).toMatchObject({
    person_image: uploadedImage,
    ordered_item_ids: ["sys-top-1", "sys-bottom-1", "sys-shoes-1"]
  });
  expect(String(tryOnRequests[0].prompt)).toContain(recommendedOutfit.try_on_prompt);
  expect(String(tryOnRequests[0].prompt)).toContain("선택된 모든 아이템을 같은 최종 이미지 한 장에 함께 반영");
  expect(String(tryOnRequests[0].prompt)).toContain("어떤 아이템도 누락하지 말 것");
  expect(Array.isArray(tryOnRequests[0].product_images)).toBe(true);
  expect((tryOnRequests[0].product_images as unknown[])).toHaveLength(3);
  for (const productImage of tryOnRequests[0].product_images as string[]) {
    expect(productImage).toMatch(/^data:image\/(png|jpeg|webp);base64,/);
  }
  await expect(page.getByText("1 크레딧 차감")).toBeVisible();
  await expect(page.getByText("체크 2회")).toBeVisible();
  const viewerBackdropMetrics = await page
    .locator(".result-modal-backdrop")
    .last()
    .evaluate((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        position: style.position,
        top: style.top,
        left: style.left,
        rectHeight: rect.height,
        viewportHeight: window.innerHeight
      };
    });
  expect(viewerBackdropMetrics.position).toBe("fixed");
  expect(viewerBackdropMetrics.top).toBe("0px");
  expect(viewerBackdropMetrics.left).toBe("0px");
  expect(viewerBackdropMetrics.rectHeight).toBeGreaterThanOrEqual(
    viewerBackdropMetrics.viewportHeight - 24
  );
  await expect(page.getByRole("heading", { name: "사이즈 체크 후보" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /사이즈 후보 보기/ })).toHaveCount(0);
  await expect(page.getByText("평소 사이즈 기준입니다.")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "내 옷장 기준" })).toBeVisible();
  await expect(page.getByRole("link", { name: /구매/ })).toHaveCount(0);
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("dialog", { name: "실착 결과 보기" })).toHaveCount(0);
  expect(deepDiveRequests).toBe(0);
  const savedState = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("reman:onboarding") ?? "{}")
  );
  expect(savedState.try_on_previews?.recommended?.preview_image).toBe(uploadedImage);
});

test("result page lets users select recommendation cards for try-on and updates credit estimate", async ({
  page
}) => {
  const uploadedImage = `data:image/png;base64,${tinyPng.buffer.toString("base64")}`;
  const tryOnRequests: Array<Record<string, unknown>> = [];

  await page.route("**/api/try-on", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    tryOnRequests.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "vertex",
        preview_image: uploadedImage,
        message: "실착 생성 완료",
        credits_remaining: 1,
        credits_charged: 2,
        idempotent_replay: false,
        credit_reference_id: "try-on-credit-selection"
      })
    });
  });

  await page.addInitScript(({ outfit, uploadedImage }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_items: [
          {
            id: "size-top",
            category: "tops",
            name: "화이트 티셔츠",
            photo_data_url: uploadedImage
          },
          {
            id: "size-bottom",
            category: "bottoms",
            name: "검정 슬랙스",
            photo_data_url: uploadedImage
          },
          {
            id: "size-shoes",
            category: "shoes",
            name: "흰색 스니커즈",
            photo_data_url: uploadedImage
          }
        ],
        feedback: {
          diagnosis: "저장된 스타일 체크 진단",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: {
            ...outfit,
            source_item_ids: {
              tops: "size-top",
              bottoms: "size-bottom",
              shoes: "size-shoes"
            }
          },
          recommendation_mix: {
            primary_source: "system",
            closet_confidence: "low",
            system_support_needed: true,
            missing_categories: [],
            summary: "시스템 추천을 먼저 보고 지금 옷장에 맞는 방향을 다시 좁혀갑니다."
          },
          system_recommendations: [
            {
              id: "sys-top-1",
              mode: "reference",
              category: "tops",
              role: "base_top",
              title: "화이트 에센셜 티셔츠",
              reason: "기본 축",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 10
            },
            {
              id: "sys-bottom-1",
              mode: "reference",
              category: "bottoms",
              role: "bottom",
              title: "검정 테이퍼드 슬랙스",
              reason: "하체 정리",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 40
            },
            {
              id: "sys-shoes-1",
              mode: "reference",
              category: "shoes",
              role: "shoes",
              title: "화이트 미니멀 스니커즈",
              reason: "가벼운 마무리",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 50
            },
            {
              id: "sys-outer-1",
              mode: "reference",
              category: "outerwear",
              role: "outerwear",
              title: "블랙 블레이저",
              reason: "정돈감",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 30
            }
          ],
          primary_outfit: {
            title: "기본 추천 조합",
            item_ids: ["sys-top-1", "sys-bottom-1", "sys-shoes-1"],
            reason: "기본 축"
          },
          selectable_recommendations: [
            {
              id: "sys-top-1",
              mode: "reference",
              category: "tops",
              role: "base_top",
              title: "화이트 에센셜 티셔츠",
              reason: "기본 축",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 10
            },
            {
              id: "sys-bottom-1",
              mode: "reference",
              category: "bottoms",
              role: "bottom",
              title: "검정 테이퍼드 슬랙스",
              reason: "하체 정리",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 40
            },
            {
              id: "sys-shoes-1",
              mode: "reference",
              category: "shoes",
              role: "shoes",
              title: "화이트 미니멀 스니커즈",
              reason: "가벼운 마무리",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 50
            },
            {
              id: "sys-outer-1",
              mode: "reference",
              category: "outerwear",
              role: "outerwear",
              title: "블랙 블레이저",
              reason: "정돈감",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 30
            }
          ],
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        }
      })
    );
  }, { outfit: recommendedOutfit, uploadedImage });

  await addTryOnSession(page);
  await page.goto("/programs/style/onboarding/result");

  await expect(page.getByRole("button", { name: /블랙 블레이저/ })).toBeVisible();
  await expect(page.getByText("선택 3개 · 예상 1 pass · 크레딧 1")).toBeVisible();
  await page.getByRole("button", { name: /블랙 블레이저/ }).click();
  await expect(page.getByText("선택 4개 · 예상 2 pass · 크레딧 2")).toBeVisible();
  await page.getByRole("button", { name: "실착 이미지 만들기" }).click();
  const tryOnDialog = page.getByRole("dialog", { name: "실착 생성 설정" });
  await expect(tryOnDialog).toBeVisible();
  await expect(tryOnDialog.getByText("선택 4개 · 예상 2 pass · 크레딧 2")).toBeVisible();
  await expect(tryOnDialog.getByText("화이트 에센셜 티셔츠", { exact: true })).toBeVisible();
  await expect(tryOnDialog.getByText("검정 테이퍼드 슬랙스", { exact: true })).toBeVisible();
  await expect(tryOnDialog.getByText("화이트 미니멀 스니커즈", { exact: true })).toBeVisible();
  await expect(tryOnDialog.getByText("블랙 블레이저", { exact: true })).toBeVisible();
  await tryOnDialog.getByRole("button", { name: "실착 생성 시작" }).click();
  await expect(page.getByRole("dialog", { name: "실착 결과 보기" })).toBeVisible();
  await expect(page.getByText("체크 1회")).toBeVisible();
  await expect(page.getByText("2 크레딧 차감")).toBeVisible();
  expect(tryOnRequests).toHaveLength(1);
  expect(tryOnRequests[0]).toMatchObject({
    person_image: uploadedImage,
    manual_order_enabled: false,
    ordered_item_ids: ["sys-top-1", "sys-outer-1", "sys-bottom-1", "sys-shoes-1"]
  });
  expect(tryOnRequests[0].selected_items).toEqual([
    expect.objectContaining({
      id: "sys-top-1",
      category: "tops",
      role: "base_top"
    }),
    expect.objectContaining({
      id: "sys-outer-1",
      category: "outerwear",
      role: "outerwear"
    }),
    expect.objectContaining({
      id: "sys-bottom-1",
      category: "bottoms",
      role: "bottom"
    }),
    expect.objectContaining({
      id: "sys-shoes-1",
      category: "shoes",
      role: "shoes"
    })
  ]);
  expect(Array.isArray(tryOnRequests[0].product_images)).toBe(true);
  expect((tryOnRequests[0].product_images as unknown[])).toHaveLength(4);
});

test("result page keeps hat and bag try-on selections in layered order", async ({ page }) => {
  const uploadedImage = `data:image/png;base64,${tinyPng.buffer.toString("base64")}`;
  const tryOnRequests: Array<Record<string, unknown>> = [];

  await page.route("**/api/try-on", async (route) => {
    tryOnRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "vertex",
        preview_image: uploadedImage,
        message: "실착 생성 완료",
        credits_remaining: 1,
        credits_charged: 2,
        idempotent_replay: false,
        credit_reference_id: "try-on-credit-accessories"
      })
    });
  });

  await page.addInitScript(({ outfit, uploadedImage }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_items: [
          {
            id: "size-top",
            category: "tops",
            name: "화이트 티셔츠",
            photo_data_url: uploadedImage
          },
          {
            id: "size-bottom",
            category: "bottoms",
            name: "검정 슬랙스",
            photo_data_url: uploadedImage
          },
          {
            id: "size-shoes",
            category: "shoes",
            name: "흰색 스니커즈",
            photo_data_url: uploadedImage
          }
        ],
        feedback: {
          diagnosis: "저장된 스타일 체크 진단",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: {
            ...outfit,
            source_item_ids: {
              tops: "size-top",
              bottoms: "size-bottom",
              shoes: "size-shoes"
            }
          },
          recommendation_mix: {
            primary_source: "system",
            closet_confidence: "low",
            system_support_needed: true,
            missing_categories: [],
            summary: "시스템 추천을 먼저 보고 지금 옷장에 맞는 방향을 다시 좁혀갑니다."
          },
          primary_outfit: {
            title: "기본 추천 조합",
            item_ids: ["sys-top-1", "sys-bottom-1", "sys-shoes-1"],
            reason: "기본 축"
          },
          selectable_recommendations: [
            {
              id: "sys-top-1",
              mode: "reference",
              category: "tops",
              role: "base_top",
              title: "화이트 에센셜 티셔츠",
              reason: "기본 축",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 10
            },
            {
              id: "sys-outer-1",
              mode: "reference",
              category: "outerwear",
              role: "outerwear",
              title: "블랙 블레이저",
              reason: "정돈감",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 30
            },
            {
              id: "sys-bottom-1",
              mode: "reference",
              category: "bottoms",
              role: "bottom",
              title: "검정 테이퍼드 슬랙스",
              reason: "하체 정리",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 40
            },
            {
              id: "sys-shoes-1",
              mode: "reference",
              category: "shoes",
              role: "shoes",
              title: "화이트 미니멀 스니커즈",
              reason: "가벼운 마무리",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 50
            },
            {
              id: "sys-hat-1",
              mode: "reference",
              category: "hats",
              role: "addon",
              title: "네이비 볼캡",
              reason: "얼굴 주변 포인트",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 60
            },
            {
              id: "sys-bag-1",
              mode: "reference",
              category: "bags",
              role: "addon",
              title: "블랙 크로스백",
              reason: "실용성과 무드 보강",
              image_url: uploadedImage,
              product: null,
              compatibility_tags: ["clean"],
              layer_order_default: 60
            }
          ],
          system_recommendations: [],
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        }
      })
    );
  }, { outfit: recommendedOutfit, uploadedImage });

  await addTryOnSession(page, "e2e-try-on-accessory-order-user");
  await page.goto("/programs/style/onboarding/result");

  await expect(page.getByRole("button", { name: /네이비 볼캡/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /블랙 크로스백/ })).toBeVisible();
  await page.getByRole("button", { name: /네이비 볼캡/ }).click();
  await page.getByRole("button", { name: /블랙 크로스백/ }).click();
  await expect(page.getByText("선택 5개 · 예상 2 pass · 크레딧 2")).toBeVisible();

  await page.getByRole("button", { name: "실착 이미지 만들기" }).click();
  const tryOnDialog = page.getByRole("dialog", { name: "실착 생성 설정" });
  await expect(tryOnDialog.getByText("선택 5개 · 예상 2 pass · 크레딧 2")).toBeVisible();
  await expect(tryOnDialog.getByText("네이비 볼캡", { exact: true })).toBeVisible();
  await expect(tryOnDialog.getByText("블랙 크로스백", { exact: true })).toBeVisible();
  await tryOnDialog.getByRole("button", { name: "실착 생성 시작" }).click();
  await expect(page.getByRole("dialog", { name: "실착 결과 보기" })).toBeVisible();

  expect(tryOnRequests).toHaveLength(1);
  expect(tryOnRequests[0]).toMatchObject({
    ordered_item_ids: ["sys-top-1", "sys-bottom-1", "sys-shoes-1", "sys-hat-1", "sys-bag-1"]
  });
});


test("result preview falls back to placeholder when a closet image fails to load", async ({ page }) => {
  await page.addInitScript((outfit) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_profile: {
          tops: "검정 반팔 티셔츠",
          bottoms: "회색 반바지",
          shoes: "검정 운동화"
        },
        closet_items: [
          {
            id: "broken-top",
            category: "tops",
            name: "검정 반팔 티셔츠",
            image_url: "/missing-top-preview.png"
          },
          {
            id: "ok-bottom",
            category: "bottoms",
            name: "회색 반바지",
            photo_data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s3FoX0AAAAASUVORK5CYII="
          },
          {
            id: "ok-shoes",
            category: "shoes",
            name: "검정 운동화",
            photo_data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s3FoX0AAAAASUVORK5CYII="
          }
        ],
        feedback: {
          diagnosis: "기본 조합",
          improvements: ["a", "b", "c"],
          recommended_outfit: {
            ...outfit,
            items: ["검정 반팔 티셔츠", "회색 반바지", "검정 운동화"],
            source_item_ids: {
              tops: "broken-top",
              bottoms: "ok-bottom",
              shoes: "ok-shoes"
            }
          },
          recommendation_mix: {
            primary_source: "closet",
            closet_confidence: "high",
            system_support_needed: false,
            missing_categories: [],
            summary: "옷장 조합"
          },
          system_recommendations: [],
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        }
      })
    );
  }, recommendedOutfit);

  await addTryOnSession(page);
  await page.goto("/programs/style/onboarding/result");

  const topPreview = page.getByRole("img", { name: "추천 상의" });
  await expect(topPreview).toBeVisible();
  await expect
    .poll(
      () =>
        topPreview.evaluate((element) =>
          (element as HTMLImageElement).getAttribute("src") ?? ""
        ),
      { timeout: 5000 }
    )
    .toContain("/system-catalog/reference-top.svg");
});

test("result page fetches signed closet previews for stored closet items", async ({
  page
}) => {
  const signedPreview =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8//8/Azbw////fwYAgOkD/Qo5OVcAAAAASUVORK5CYII=";

  await page.route("**/api/closet/previews", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        previews: [
          { id: "stored-top", preview_url: signedPreview },
          { id: "stored-bottom", preview_url: signedPreview },
          { id: "stored-shoes", preview_url: signedPreview }
        ]
      })
    });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_profile: {
          tops: "검정 티셔츠",
          bottoms: "회색 반바지",
          shoes: "검정 운동화"
        },
        closet_items: [
          {
            id: "stored-top",
            category: "tops",
            name: "검정 반팔 티셔츠",
            storage_bucket: "closet",
            storage_path: "users/demo/top.jpg"
          },
          {
            id: "stored-bottom",
            category: "bottoms",
            name: "회색 FCMM 무한도전 반바지",
            storage_bucket: "closet",
            storage_path: "users/demo/bottom.jpg"
          },
          {
            id: "stored-shoes",
            category: "shoes",
            name: "검정 운동화",
            storage_bucket: "closet",
            storage_path: "users/demo/shoes.jpg"
          }
        ],
        feedback: {
          diagnosis: "저장된 스타일 체크 진단",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: {
            title: "검정 반팔 티셔츠 중심으로 시작",
            items: ["검정 반팔 티셔츠", "회색 FCMM 무한도전 반바지", "검정 운동화"],
            reason: "지금 가진 옷들 중에서 가장 편안하고 잘 맞는 조합이에요.",
            try_on_prompt: "uploaded outfit board",
            source_item_ids: {
              tops: "stored-top",
              bottoms: "stored-bottom",
              shoes: "stored-shoes"
            }
          },
          recommendation_mix: {
            primary_source: "closet",
            closet_confidence: "high",
            system_support_needed: false,
            missing_categories: [],
            summary: "옷장 조합"
          },
          system_recommendations: [],
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        }
      })
    );
  });

  await addTryOnSession(page);
  await page.goto("/programs/style/onboarding/result");

  await expect
    .poll(
      () =>
        page
          .getByRole("img", { name: "추천 상의" })
          .evaluate((element) => (element as HTMLImageElement).getAttribute("src") ?? ""),
      { timeout: 5000 }
    )
    .toContain(signedPreview);
});

test("result page replaces legacy system placeholder artwork with current system assets", async ({
  page
}) => {
  const uploadedImage = `data:image/png;base64,${tinyPng.buffer.toString("base64")}`;

  await page.addInitScript((uploadedImage) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_profile: {
          tops: "무지 티셔츠",
          bottoms: "청바지",
          shoes: "흰색 스니커즈"
        },
        closet_items: [],
        feedback: {
          diagnosis: "저장된 스타일 체크 진단",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: {
            title: "기준 조합",
            items: ["검정 반팔 티셔츠", "검정 테이퍼드 슬랙스", "화이트 미니멀 스니커즈"],
            reason: "기본 조합",
            try_on_prompt: "prompt"
          },
          recommendation_mix: {
            primary_source: "system",
            closet_confidence: "low",
            system_support_needed: true,
            missing_categories: ["tops", "bottoms", "shoes"],
            summary: "시스템 추천"
          },
          system_recommendations: [
            {
              id: "legacy-top",
              mode: "reference",
              category: "tops",
              title: "하늘색 옥스퍼드 셔츠",
              color: "하늘색",
              fit: "레귤러",
              reason: "얼굴 주변을 정리합니다.",
              image_url: "/system-catalog/reference-top.svg",
              product: null
            },
            {
              id: "legacy-bottom",
              mode: "reference",
              category: "bottoms",
              title: "검정 테이퍼드 슬랙스",
              color: "검정",
              fit: "테이퍼드",
              reason: "실루엣을 정리합니다.",
              image_url: "/system-catalog/reference-bottom.svg",
              product: null
            },
            {
              id: "legacy-shoes",
              mode: "reference",
              category: "shoes",
              title: "화이트 미니멀 스니커즈",
              color: "화이트",
              fit: "로우탑",
              reason: "전체 코디를 가볍게 정리합니다.",
              image_url: "/system-catalog/reference-shoes.svg",
              product: null
            }
          ],
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        },
        image: uploadedImage
      })
    );
  }, uploadedImage);

  await addTryOnSession(page);
  await page.goto("/programs/style/onboarding/result");

  await expect
    .poll(
      () =>
        page
          .getByRole("img", { name: /시스템 추천 tops/i })
          .evaluate((element) => (element as HTMLImageElement).getAttribute("src") ?? ""),
      { timeout: 5000 }
    )
    .toContain("/system-catalog/tops/");
});

test("hybrid recommendation shows system block first when system is the primary source", async ({
  page
}) => {
  await page.addInitScript((uploadedImage) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_profile: {
          tops: "무지 티셔츠",
          bottoms: "",
          shoes: ""
        },
        closet_items: [
          {
            id: "top-1",
            category: "tops",
            name: "흰색 무지 티셔츠",
            color: "흰색",
            wear_state: "잘 맞음",
            condition: "깨끗함"
          }
        ],
        image: uploadedImage,
        feedback: {
          diagnosis: "시스템 추천 우선 결과",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: {
            title: "보유 옷 기준 조합",
            items: ["흰색 무지 티셔츠", "진청 데님", "흰색 스니커즈"],
            reason: "현재 옷장 기준으로 가장 무난한 조합입니다.",
            try_on_prompt: "전신 정면 자연광 실착",
            source_item_ids: {
              tops: "top-1"
            }
          },
          recommendation_mix: {
            primary_source: "system",
            closet_confidence: "low",
            system_support_needed: true,
            missing_categories: ["bottoms", "shoes"],
            summary: "시스템 추천을 먼저 보고 옷장 조합을 보조로 확인합니다."
          },
          system_recommendations: [
            {
              id: "sys-bottom-1",
              mode: "reference",
              category: "bottoms",
              title: "스트레이트 데님",
              color: "진청",
              reason: "기본 상의와 가장 안정적으로 이어집니다.",
              product: null
            },
            {
              id: "sys-shoes-1",
              mode: "reference",
              category: "shoes",
              title: "로우탑 스니커즈",
              color: "오프화이트",
              reason: "전체 톤을 가볍게 정리합니다.",
              product: null
            }
          ],
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        }
      })
    );
  }, `data:image/png;base64,${tinyPng.buffer.toString("base64")}`);

  await addTryOnSession(page);
  await page.goto("/programs/style/onboarding/result");

  await expect(page.getByRole("heading", { name: "시스템 추천" })).toBeVisible();
  await expect(page.getByText("출처 라벨", { exact: false })).toHaveCount(0);
  await expect(page.getByText("시스템 추천 참고")).toBeVisible();
  await expect(page.getByRole("link", { name: /구매/ })).toHaveCount(0);

  const blockOrder = await page.locator("[data-testid='recommendation-block']").evaluateAll(
    (nodes) =>
      nodes.map((node) =>
        node.querySelector("h2")?.textContent?.trim() ?? ""
      )
  );

  expect(blockOrder.slice(0, 2)).toEqual(["시스템 추천", "내 옷장 기준"]);
});

test("hybrid recommendation shows closet block first when closet is the primary source", async ({
  page
}) => {
  await page.addInitScript((uploadedImage) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_profile: {
          tops: "셔츠",
          bottoms: "슬랙스",
          shoes: "스니커즈"
        },
        closet_items: [
          {
            id: "top-1",
            category: "tops",
            name: "네이비 셔츠",
            color: "네이비",
            wear_state: "잘 맞음",
            wear_frequency: "자주 입음",
            condition: "깨끗함"
          },
          {
            id: "bottom-1",
            category: "bottoms",
            name: "검정 슬랙스",
            color: "검정",
            wear_state: "잘 맞음",
            wear_frequency: "자주 입음",
            condition: "깨끗함"
          },
          {
            id: "shoes-1",
            category: "shoes",
            name: "흰색 스니커즈",
            color: "흰색",
            wear_state: "잘 맞음",
            wear_frequency: "자주 입음",
            condition: "깨끗함"
          }
        ],
        image: uploadedImage,
        feedback: {
          diagnosis: "옷장 추천 우선 결과",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: {
            title: "네이비 셔츠 기본 조합",
            items: ["네이비 셔츠", "검정 슬랙스", "흰색 스니커즈"],
            reason: "지금 가진 옷으로 톤 정리가 가장 쉽습니다.",
            try_on_prompt: "전신 정면 자연광 실착",
            source_item_ids: {
              tops: "top-1",
              bottoms: "bottom-1",
              shoes: "shoes-1"
            }
          },
          recommendation_mix: {
            primary_source: "closet",
            closet_confidence: "high",
            system_support_needed: false,
            missing_categories: [],
            summary: "주 조합은 옷장 기준으로 구성합니다."
          },
          system_recommendations: [
            {
              id: "sys-top-1",
              mode: "reference",
              category: "tops",
              title: "차콜 니트 폴로",
              color: "차콜",
              reason: "같은 무드로 변주하기 좋습니다.",
              product: null
            }
          ],
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        }
      })
    );
  }, `data:image/png;base64,${tinyPng.buffer.toString("base64")}`);

  await addTryOnSession(page);
  await page.goto("/programs/style/onboarding/result");

  const blockOrder = await page.locator("[data-testid='recommendation-block']").evaluateAll(
    (nodes) =>
      nodes.map((node) =>
        node.querySelector("h2")?.textContent?.trim() ?? ""
      )
  );

  expect(blockOrder.slice(0, 2)).toEqual(["내 옷장 기준", "시스템 추천"]);
  await expect(page.getByText("시스템 추천 참고")).toBeVisible();
  await expect(page.getByRole("link", { name: /구매/ })).toHaveCount(0);
});

test("result keeps size candidates out of the MVP golden path", async ({ page }) => {
  await page.addInitScript((outfit) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_profile: {
          tops: "무지 티셔츠",
          bottoms: "청바지",
          shoes: "흰색 스니커즈"
        },
        feedback: {
          diagnosis: "저장된 스타일 체크 진단",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: outfit,
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        }
      })
    );
  }, recommendedOutfit);

  await addTryOnSession(page);
  await page.goto("/programs/style/onboarding/result");

  await expect(page.getByRole("heading", { name: "사이즈 체크 후보" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /사이즈 후보 보기/ })).toHaveCount(0);
  await expect(page.getByText("사이즈 정보를 추가하면 후보를 좁힐 수 있습니다.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "사이즈 추가하기" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /구매/ })).toHaveCount(0);
});

test("onboarding shows fallback when storage upload fails", async ({ page }) => {
  await addTryOnSession(page, "e2e-storage-failure-user");
  await page.route("**/api/feedback", async (route) => {
    const headers = {
      ...route.request().headers(),
      "x-harness-storage-failure-mode": "upload"
    };

    await route.continue({ headers });
  });

  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();

  await page.locator("#photo-upload").setInputFiles(tinyPng);
  await fillUploadContext(page);
  await page.getByRole("button", { name: "AI 분석 시작하기" }).click();

  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/analyzing$/);
  await expect(
    page.getByText("지금 사진 분석이 잠깐 어려운 상황이에요.")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "텍스트 설명 다시 입력하기" })).toBeVisible();
});

test("upload requires top bottom and shoes closet context before analysis", async ({ page }) => {
  await addTryOnSession(page, "e2e-minimum-closet-user");
  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();

  await page.locator("#photo-upload").setInputFiles(tinyPng);
  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await page.getByRole("button", { name: /한 벌 직접 등록/ }).click();
  await page.locator("#closet-photo-upload").setInputFiles(tinyPng);
  await page.getByLabel("종류").selectOption("tops");
  await page.getByRole("button", { name: /선택 정보/ }).click();
  await page.getByLabel("아이템 이름").fill("네이비 셔츠");
  await page.getByRole("button", { name: /사진을 옷장에 추가/ }).click();

  await expect(page.getByLabel("추천에 필요한 옷장").getByText("상의 ✓")).toBeVisible();
  await expect(page.getByLabel("추천에 필요한 옷장").getByText("하의 필요")).toBeVisible();
  await expect(page.getByLabel("추천에 필요한 옷장").getByText("신발 필요")).toBeVisible();
  await expect(
    page.locator(".upload-closet-summary").getByText("하의, 신발 필요")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 분석 시작하기" })).toBeDisabled();

  await page.getByRole("button", { name: "하의 추가" }).click();
  await expect(page.getByRole("heading", { name: "옷 추가" })).toBeVisible();
  await expect(page.getByLabel("종류")).toHaveValue("bottoms");
});

test("style upload closet edits persist before analysis starts", async ({ page }) => {
  await addTryOnSession(page, "e2e-upload-closet-sync-user");
  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();
  await expect(page.getByRole("heading", { name: "사진이 기준입니다" })).toBeVisible();

  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await page.getByRole("button", { name: /한 벌 직접 등록/ }).click();
  await expect(page.locator("#closet-photo-camera")).toHaveAttribute("capture", "environment");
  await page.locator("#closet-photo-upload").setInputFiles(tinyPng);
  await page.getByLabel("종류").selectOption("tops");
  await page.getByRole("button", { name: /선택 정보/ }).click();
  await page.getByLabel("아이템 이름").fill("업로드 단계 셔츠");
  await page.getByRole("button", { name: /사진을 옷장에 추가/ }).click();

  await expect(page.getByText(/계정 옷장에 저장됨|계정 저장 실패/)).toBeVisible();

  const savedState = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("reman:onboarding") ?? "{}")
  );

  expect(savedState.closet_items).toHaveLength(1);
  expect(savedState.closet_items[0].name).toBe("업로드 단계 셔츠");
  expect(savedState.closet_profile.tops).toContain("업로드 단계 셔츠");
});

test("onboarding shows a specific message when feedback is rate limited", async ({ page }) => {
  await addTryOnSession(page);
  await page.route("**/api/feedback", async (route) => {
    await route.fulfill({
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "42"
      },
      body: JSON.stringify({
        error: "rate_limited",
        reset_at: Date.now() + 42_000
      })
    });
  });

  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();

  await page.locator("#photo-upload").setInputFiles(tinyPng);
  await fillUploadContext(page);
  await page.getByRole("button", { name: "AI 분석 시작하기" }).click();

  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/analyzing$/);
  await expect(page.getByText("요청이 너무 빠르게 반복됐습니다.")).toBeVisible();
  await expect(page.getByText("약 42초 뒤 다시 시도할 수 있습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "텍스트 설명 다시 입력하기" })).toBeVisible();
});

test("onboarding shows a specific message when credits are insufficient", async ({ page }) => {
  await addTryOnSession(page, "e2e-insufficient-credits-user");
  await page.route("**/api/feedback", async (route) => {
    await route.fulfill({
      status: 402,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "insufficient_credits",
        message: "스타일 체크에 필요한 크레딧이 부족합니다.",
        credits_remaining: 0,
        credits_required: 1
      })
    });
  });

  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();

  await page.locator("#photo-upload").setInputFiles(tinyPng);
  await fillUploadContext(page);
  await page.getByRole("button", { name: "AI 분석 시작하기" }).click();

  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/analyzing$/);
  await expect(page.getByText("스타일 체크에 필요한 크레딧이 부족합니다.")).toBeVisible();
  await expect(page.getByRole("link", { name: /구매/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "텍스트 설명 다시 입력하기" })).toBeVisible();
});

test("try-on rejects unauthenticated requests", async ({ request }) => {
  const response = await request.post("/api/try-on", {
    data: {
      person_image: `data:image/png;base64,${tinyPng.buffer.toString("base64")}`,
      product_images: [`data:image/png;base64,${tinyPng.buffer.toString("base64")}`],
      prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
    }
  });

  expect(response.status()).toBe(401);
});

test("signed-in users can save recommendation feedback from result page", async ({ page }) => {
  const uploadedImage = `data:image/png;base64,${tinyPng.buffer.toString("base64")}`;

  await addTryOnSession(page);
  await page.addInitScript(({ outfit, uploadedImage }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_profile: {
          tops: "무지 티셔츠",
          bottoms: "청바지",
          shoes: "흰색 스니커즈"
        },
        image: uploadedImage,
        feedback: {
          diagnosis: "계정 저장 테스트 진단",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: outfit,
          recommendation_mix: {
            primary_source: "closet",
            closet_confidence: "high",
            system_support_needed: false,
            missing_categories: [],
            summary: "주 조합은 옷장 기준으로 구성합니다."
          },
          system_recommendations: [],
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        }
      })
    );
  }, { outfit: recommendedOutfit, uploadedImage });

  await page.goto("/programs/style/onboarding/result");
  await expect(page.getByRole("button", { name: /계정 저장 열기/ })).toHaveCount(0);
  await page.getByRole("button", { name: /나중에 보기/ }).click();
  await page.getByRole("button", { name: "추천 반응 저장" }).click();
  await expect(page.getByRole("button", { name: /나중에 다시 보기 저장됨/ })).toBeVisible();

  const savedState = await page.evaluate(() => JSON.parse(window.localStorage.getItem("reman:onboarding") ?? "{}"));

  expect(savedState.user_id).toBe("e2e-try-on-user");
  expect(savedState.email).toBe("try-on@example.com");
  expect(savedState.recommendation_feedback.reaction).toBe("save_for_later");
  expect(savedState.feedback_history[0].summary).toContain("계정 저장 테스트 진단");
});

test("home stays a feature hub for active style user", async ({ page }) => {
  await page.addInitScript((outfit) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원"
        },
        feedback: {
          diagnosis: "첫 피드백이 저장된 상태",
          improvements: ["a", "b", "c"],
          recommended_outfit: outfit,
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        },
        daily_feedbacks: {
          "2": {
            diagnosis: "Day 2 피드백",
            improvements: ["a", "b", "c"],
            today_action: "오늘 액션",
            tomorrow_preview: "내일 초점"
          }
        },
        feedback_history: [
          { day: 1, summary: "Day 1 요약" },
          { day: 2, summary: "Day 2 요약" }
        ]
      })
    );
  }, recommendedOutfit);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "관리 홈" })
  ).toBeVisible();
  await expect(page.getByText("최근 결과가 있습니다.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "기록 보기" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "스타일 사진 체크" })).toBeVisible();
  await expect(page.getByText("추천", { exact: true })).toBeVisible();
  await expect(page.getByText("이벤트", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "스타일 체크 시작 →" }).click();
  await expect(page).toHaveURL(/\/programs\/style$/);
});

test("home stays a feature hub for finished style user", async ({ page }) => {
  await page.addInitScript((outfit) => {
    const dailyFeedbacks: Record<string, unknown> = {};

    for (let day = 2; day <= 7; day += 1) {
      dailyFeedbacks[String(day)] = {
        diagnosis: `Day ${day} 피드백`,
        improvements: ["a", "b", "c"],
        today_action: "오늘 액션",
        tomorrow_preview: "내일 초점"
      };
    }

    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원"
        },
        feedback: {
          diagnosis: "첫 피드백이 저장된 상태",
          improvements: ["a", "b", "c"],
          recommended_outfit: outfit,
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        },
        daily_feedbacks: dailyFeedbacks,
        feedback_history: [
          { day: 1, summary: "Day 1 요약" },
          { day: 7, summary: "Day 7 요약" }
        ]
      })
    );
  }, recommendedOutfit);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "관리 홈" })
  ).toBeVisible();
  await expect(page.getByText("결과 또는 새 체크.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "기록 보기" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "스타일 사진 체크" })).toBeVisible();
  await expect(page.getByRole("link", { name: "전체 보기" })).toBeVisible();
  await page.getByRole("link", { name: "전체 보기" }).click();
  await expect(page).toHaveURL(/\/programs$/);
});

test("style program sends missing closet users to one closet CTA", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원"
        },
        closet_items: [
          {
            id: "style-top-only",
            category: "tops",
            name: "흰색 티셔츠"
          }
        ]
      })
    );
  });

  await page.goto("/programs/style");

  const nextAction = page.getByRole("region", { name: "스타일 체크 다음 행동" });
  await expect(nextAction).toBeVisible();
  await expect(nextAction.getByRole("heading", { name: "옷장부터 채우기" })).toBeVisible();
  await expect(nextAction.getByText("하의, 신발 필요")).toBeVisible();
  await expect(nextAction.getByRole("link", { name: "옷장 채우기" })).toHaveAttribute(
    "href",
    "/closet"
  );
  await expect(nextAction.getByRole("link", { name: /사진 업로드/ })).toHaveCount(0);
});

test("style program sends ready closet users directly to photo upload", async ({ page }) => {
  await page.addInitScript(({ uploadedImage }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원"
        },
        closet_items: [
          {
            id: "style-ready-top",
            category: "tops",
            name: "네이비 셔츠",
            photo_data_url: uploadedImage
          },
          {
            id: "style-ready-bottom",
            category: "bottoms",
            name: "검정 슬랙스",
            photo_data_url: uploadedImage
          },
          {
            id: "style-ready-shoes",
            category: "shoes",
            name: "흰색 스니커즈",
            photo_data_url: uploadedImage
          }
        ]
      })
    );
  }, { uploadedImage: `data:image/png;base64,${tinyPng.buffer.toString("base64")}` });

  await page.goto("/programs/style");

  const nextAction = page.getByRole("region", { name: "스타일 체크 다음 행동" });
  await expect(nextAction).toBeVisible();
  await expect(nextAction.getByRole("heading", { name: "사진만 올리기" })).toBeVisible();
  await expect(nextAction.getByText("상의, 하의, 신발 준비됨")).toBeVisible();
  await expect(nextAction.getByRole("link", { name: "사진 업로드" })).toHaveAttribute(
    "href",
    "/programs/style/onboarding/upload?reset=photo"
  );
  await expect(nextAction.getByRole("link", { name: /옷장 채우기/ })).toHaveCount(0);
});

test("program hub opens coming soon program placeholder", async ({ page }) => {
  await page.goto("/programs");
  await page.getByRole("link", { name: "헤어" }).click();
  await expect(page).toHaveURL(/\/programs\/hair$/);
  await expect(page.getByRole("heading", { name: "헤어" })).toBeVisible();
  await expect(page.getByText("지금은 스타일 먼저.")).toBeVisible();
  await expect(page.getByRole("link", { name: "다른 프로그램으로 돌아가기" })).toBeVisible();
  await expect(page.getByRole("link", { name: "스타일 프로그램 먼저 시작하기" })).toBeVisible();
});

test("authenticated app navigation keeps credit visible without repeated session checks", async ({ page }) => {
  await addTryOnSession(page, "e2e-session-budget-user");

  const sessionRequests: string[] = [];

  page.on("request", (request) => {
    if (request.url().includes("/api/auth/session")) {
      sessionRequests.push(request.url());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "관리 홈" })).toBeVisible();
  await expect(page.getByText("체크 3회")).toBeVisible();

  await page.getByLabel("주요 메뉴").getByRole("link", { name: "스타일" }).click();
  await expect(page).toHaveURL(/\/programs\/style$/);
  await expect(page.getByText("체크 3회")).toBeVisible();

  await page.getByLabel("주요 메뉴").getByRole("link", { name: "옷장" }).click();
  await expect(page).toHaveURL(/\/closet$/);
  await expect(page.getByText("체크 3회")).toBeVisible();

  await page.getByLabel("주요 메뉴").getByRole("link", { name: "기록" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByText("체크 3회")).toBeVisible();

  expect(sessionRequests.length).toBeLessThanOrEqual(2);
});

test("protected profile redirects to login when no session is present", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fprofile$/);
  await expect(
    page.getByRole("heading", { name: "진행한 변화와 계정을 함께 관리합니다" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();
});

test("home header hides login pill when no session is present", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "관리 홈" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Login" })).toHaveCount(0);
});

test("protected closet redirects to login when no session is present", async ({ page }) => {
  await page.goto("/closet");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fcloset$/);
  await expect(page.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();
});

test("protected history redirects to login when no session is present", async ({ page }) => {
  await page.goto("/history");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fhistory$/);
  await expect(page.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();
});

test("local dev login opens protected app pages for browser review", async ({ page }) => {
  await page.goto("/login?returnTo=/closet");
  await page.getByRole("button", { name: "개발용으로 계속하기" }).click();

  await expect(page).toHaveURL(/\/closet$/);
  await expect(page.getByRole("heading", { name: "옷장 사진 저장" })).toBeVisible();
  await expect(page.getByText("체크 3회").first()).toBeVisible();
});

test("closet page renders local closet before remote profile sync", async ({ page }) => {
  await page.addInitScript(({ uploadedImage }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_items: [
          {
            id: "local-shirt",
            category: "tops",
            name: "네이비 셔츠",
            photo_data_url: uploadedImage,
            color: "네이비",
            size: "L"
          }
        ],
        closet_profile: {
          tops: "네이비 셔츠",
          bottoms: "",
          shoes: "",
          outerwear: "",
          avoid: ""
        }
      })
    );
  }, { uploadedImage: `data:image/png;base64,${tinyPng.buffer.toString("base64")}` });

  await addTryOnSession(page);
  await page.goto("/closet");

  await expect(page.getByRole("heading", { name: "옷장 사진 저장" })).toBeVisible();
  await expect(page.getByText("옷장을 불러오는 중.")).toHaveCount(0);
  await expect(page.getByText("1").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "옷장 저장" })).toBeVisible();
});

test("closet page saves items into the next style check context", async ({ page }) => {
  await addTryOnSession(page);
  await page.goto("/closet");

  await expect(page.getByRole("heading", { name: "옷장 사진 저장" })).toBeVisible();
  await expect(page.getByRole("button", { name: "옷장 저장" })).toBeVisible();
  await expect(page.getByRole("button", { name: "옷 추가", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await expect(page.getByLabel("아이템 이름")).toHaveCount(0);
  await expect(page.getByLabel("색")).toHaveCount(0);
  await page.getByRole("button", { name: /한 벌 직접 등록/ }).click();
  await expect(page.locator("#closet-photo-upload")).toHaveAttribute("accept", "image/*");
  await expect(page.locator("#closet-photo-camera")).toHaveAttribute("accept", "image/*");
  await expect(page.locator("#closet-photo-camera")).toHaveAttribute("capture", "environment");
  await page.locator("#closet-photo-upload").setInputFiles(tinyPng);
  await page.getByLabel("종류").selectOption("tops");
  await page.getByRole("button", { name: /선택 정보/ }).click();
  await expect(page.getByLabel("아이템 이름")).toBeVisible();
  await page.getByLabel("아이템 이름").fill("옥스포드 셔츠");
  await page.getByLabel("색").fill("하늘색");
  await page.getByLabel("핏").fill("레귤러");
  await page.getByLabel("사이즈").fill("L");
  await page.getByLabel("착용감").selectOption("잘 맞음");
  await page.getByLabel("빈도").selectOption("자주 입음");
  await page.getByLabel("계절").selectOption("봄/가을");
  await selectClosetOptionalField(page, "상태", "깨끗함");
  await page.getByRole("button", { name: /사진을 옷장에 추가/ }).click();
  const closedTopShelf = page.getByRole("button", { name: "상의 행거 · 1 열기" });
  if (await closedTopShelf.count()) {
    await closedTopShelf.click();
  }
  await expect(page.getByRole("button", { name: "상의 행거 · 1 닫기" })).toBeVisible();
  await page.getByRole("button", { name: /하늘색 옥스포드 셔츠/ }).click();
  const actionDialog = page.getByRole("dialog", { name: "옷 선택 행동" });
  await expect(actionDialog).toBeVisible();
  await actionDialog.getByRole("button", { name: "수정" }).click();
  const editDialog = page.getByRole("dialog", { name: "옷 수정" });
  await expect(editDialog).toBeVisible();
  await editDialog.getByRole("button", { name: "선택 정보 펼치기" }).click();
  await editDialog.getByLabel("빈도").selectOption("가끔 입음");
  await editDialog.getByLabel("계절").selectOption("여름");
  await selectClosetOptionalField(editDialog, "상태", "수선 필요");
  await editDialog.getByRole("button", { name: "수정 저장" }).click();

  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await page.getByRole("button", { name: /한 벌 직접 등록/ }).click();
  await page.locator("#closet-photo-upload").setInputFiles(tinyPng);
  await page.getByLabel("종류").selectOption("bottoms");
  await page.getByRole("button", { name: /사진을 옷장에 추가/ }).click();
  await expect(page.getByPlaceholder("피하고 싶은 핏, 색, 아이템")).toHaveCount(0);
  await page.getByRole("button", { name: "옷장 저장" }).click();

  await expect(
    page.getByText(/옷장이 저장되었습니다\.|계정 저장 실패\./)
  ).toBeVisible();

  const savedState = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("reman:onboarding") ?? "{}")
  );

  expect(savedState.closet_items).toHaveLength(2);
  expect(savedState.closet_items[0].photo_data_url).toMatch(/^data:image\/jpeg;base64,/);
  expect(savedState.closet_items[1].name).toBe("하의 사진");
  expect(savedState.closet_profile.tops).toContain("하늘색 옥스포드 셔츠");
  expect(savedState.closet_profile.tops).toContain("[L]");
  expect(savedState.closet_profile.tops).toContain("{잘 맞음}");
  expect(savedState.closet_profile.tops).toContain("빈도:가끔 입음");
  expect(savedState.closet_profile.tops).toContain("계절:여름");
  expect(savedState.closet_profile.tops).toContain("상태:수선 필요");
  expect(savedState.closet_profile.tops).not.toContain("빈도:자주 입음");
  expect(savedState.closet_profile.tops).not.toContain("계절:봄/가을");
  expect(savedState.closet_profile.tops).not.toContain("상태:깨끗함");
  expect(savedState.closet_items[0].wear_frequency).toBe("가끔 입음");
  expect(savedState.closet_items[0].season).toBe("여름");
  expect(savedState.closet_items[0].condition).toBe("수선 필요");
  expect(savedState.closet_profile.bottoms).toContain("하의 사진");
  expect(savedState.closet_profile.avoid).toBe("");
});

test("profile shows saved style check context for signed-in users", async ({ page }) => {
  await page.addInitScript(({ outfit }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        user_id: "e2e-try-on-user",
        email: "try-on@example.com",
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_profile: {
          tops: "무지 티셔츠, 후드티",
          bottoms: "청바지, 검정 슬랙스",
          shoes: "흰색 스니커즈",
          outerwear: "셔츠"
        },
        closet_items: [
          {
            id: "history-top",
            category: "tops",
            name: "네이비 셔츠",
            color: "네이비",
            size: "L",
            photo_data_url: "data:image/png;base64,test"
          },
          {
            id: "history-bottom",
            category: "bottoms",
            name: "검정 슬랙스",
            color: "검정",
            size: "32",
            photo_data_url: "data:image/png;base64,test"
          },
          {
            id: "history-shoes",
            category: "shoes",
            name: "흰색 스니커즈",
            color: "흰색",
            size: "270",
            photo_data_url: "data:image/png;base64,test"
          }
        ],
        feedback: {
          diagnosis: "최근 스타일 체크 진단",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: {
            ...outfit,
            source_item_ids: {
              tops: "history-top",
              bottoms: "history-bottom",
              shoes: "history-shoes"
            }
          },
          today_action: "오늘은 상의 길이를 비교해보세요.",
          day1_mission: "옷장 조합을 확인해보세요."
        },
        deep_dive_feedbacks: {
          fit: {
            title: "핏 체크",
            diagnosis: "기장 점검",
            focus_points: ["상의 길이", "바지 핏"],
            recommendation: "상의 끝을 확인하세요.",
            action: "거울 앞에서 비교하기"
          },
          color: {
            title: "색 조합 체크",
            diagnosis: "톤 점검",
            focus_points: ["상의 색", "신발 색"],
            recommendation: "튀는 색을 줄이세요.",
            action: "검정 하의로 비교하기"
          }
        },
        try_on_previews: {
          cached_preview: {
            cache_key: "cached_preview",
            source: "reference",
            reference_id: "recommended",
            prompt: outfit.try_on_prompt,
            provider: "vertex",
            preview_image: "data:image/png;base64,test",
            message: "저장된 실착 결과",
            created_at: "2026-04-14T00:00:00.000Z"
          }
        },
        recommendation_feedback: {
          reaction: "helpful",
          note: "셔츠 방향이 좋음",
          outfit_title: outfit.title,
          created_at: "2026-04-15T00:00:00.000Z"
        },
        feedback_history: [
          {
            day: 1,
            summary: "최근 스타일 체크 진단",
            action: "오늘은 상의 길이를 비교해보세요."
          }
        ]
      })
    );
  }, { outfit: recommendedOutfit });

  await addTryOnSession(page);
  await page.goto("/profile");

  await expect(
    page.getByRole("heading", { name: "내 정보" })
  ).toBeVisible();
  await expect(page.getByText("Try On User")).toBeVisible();
  await expect(page.getByText("try-on@example.com")).toBeVisible();
  await expect(page.getByText("Google")).toBeVisible();
  await expect(page.getByText("체크 3회")).toBeVisible();
  await expect(page.getByRole("region", { name: "크레딧 기록" })).toBeVisible();
  await expect(page.getByText("시작 크레딧")).toBeVisible();
  await expect(page.getByText("+3")).toBeVisible();
  await expect(page.getByText("스타일", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "내 데이터" })).toBeVisible();
  await expect(page.getByText("옷장 3개")).toBeVisible();
  await expect(page.getByText("기록 3개")).toBeVisible();
  await expect(page.getByText("반응 저장됨")).toBeVisible();
  await expect(page.getByText("최근 스타일 체크 진단")).toHaveCount(0);
  await expect(page.getByText("Saved Feedback")).toHaveCount(0);
  await expect(page.getByText("Deep Dive")).toHaveCount(0);
  const primaryActions = page.getByRole("region", { name: "주요 행동" });
  await expect(primaryActions.getByRole("link", { name: "새 체크" })).toBeVisible();
  await expect(primaryActions.getByRole("link", { name: "옷장" })).toBeVisible();
  await expect(primaryActions.getByRole("link", { name: "기록" })).toBeVisible();
  await expect(primaryActions.getByRole("link", { name: "설정" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "계정 관리" })).toBeVisible();
  await expect(page.getByRole("link", { name: /크레딧 확인/ })).toHaveCount(0);
  await page.getByRole("region", { name: "주요 행동" }).getByRole("link", { name: "기록" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { name: "기록" })).toBeVisible();
  await expect(page.getByText("불러오는 중")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "기본 조합" })).toBeVisible();
  await expect(page.getByText("도움됨 · 셔츠 방향이 좋음")).toBeVisible();
  await expect(page.getByText("핏 체크")).toBeVisible();
  await expect(page.getByText("Records")).toBeVisible();
  await page.getByRole("button", { name: /기본 조합/ }).click();
  await expect(page.getByText("옷장 ID 검증").first()).toBeVisible();
  await expect(page.getByText("추천 조합")).toBeVisible();
  await expect(page.getByText("오늘 실행")).toBeVisible();
  const historyRecommendationBox = await page.getByText("추천 조합").boundingBox();
  const historyActionBox = await page.getByText("오늘 실행").boundingBox();
  const historyBasisBox = await page.getByText("추천에 쓴 옷").boundingBox();
  const historyReactionBox = await page.getByText("내 반응", { exact: true }).boundingBox();
  expect(historyRecommendationBox).not.toBeNull();
  expect(historyActionBox).not.toBeNull();
  expect(historyBasisBox).not.toBeNull();
  expect(historyReactionBox).not.toBeNull();
  if (historyRecommendationBox && historyActionBox && historyBasisBox && historyReactionBox) {
    expect(historyRecommendationBox.y).toBeLessThan(historyActionBox.y);
    expect(historyActionBox.y).toBeLessThan(historyBasisBox.y);
    expect(historyBasisBox.y).toBeLessThan(historyReactionBox.y);
  }
  await expect(page.getByText("옷장 유지")).toBeVisible();
  await expect(page.getByText("반응 유지")).toBeVisible();
  await expect(page.getByText("사진만 새로")).toBeVisible();
  await expect(page.getByRole("region", { name: "저장한 반응" })).toBeVisible();
  await expect(page.getByRole("region", { name: "다음 행동" })).toBeVisible();
  await expect(page.getByText("추천에 쓴 옷")).toBeVisible();
  await expect(page.getByText("네이비 셔츠")).toBeVisible();
  await expect(page.getByText("검정 슬랙스")).toBeVisible();
  await expect(page.getByText("흰색 스니커즈")).toBeVisible();
  await expect(page.getByText("추천에 사용").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "비슷하게 다시 체크" })).toBeVisible();
  await expect(page.getByRole("link", { name: /최근 결과 보기/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /새 사진으로 다시 체크/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /옷장 관리/ })).toHaveCount(0);
  await page.getByRole("link", { name: "결과 보기" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/result$/);
});

test("history can restart a similar style check while preserving context", async ({ page }) => {
  const uploadedImage = `data:image/png;base64,${tinyPng.buffer.toString("base64")}`;

  await page.addInitScript(({ outfit, uploadedImage }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        user_id: "e2e-history-repeat-user",
        email: "try-on@example.com",
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_items: [
          {
            id: "repeat-top",
            category: "tops",
            name: "네이비 셔츠",
            size: "L",
            wear_state: "잘 맞음",
            photo_data_url: uploadedImage
          }
        ],
        image: uploadedImage,
        feedback: {
          diagnosis: "이전 체크 진단",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: {
            ...outfit,
            source_item_ids: {
              tops: "repeat-top"
            }
          },
          today_action: "셔츠를 입은 버전과 비교하세요.",
          day1_mission: "옷장 조합을 확인해보세요."
        },
        recommendation_feedback: {
          reaction: "helpful",
          note: "셔츠 방향 유지",
          outfit_title: outfit.title,
          created_at: "2026-04-16T00:00:00.000Z"
        }
      })
    );
  }, { outfit: recommendedOutfit, uploadedImage });

  await addTryOnSession(page, "e2e-history-repeat-user");
  await page.goto("/history");
  await page.getByRole("button", { name: /기본 조합/ }).click();
  await page.getByRole("button", { name: "비슷하게 다시 체크" }).click();

  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/upload$/);
  await expect(page.getByRole("heading", { name: "사진이 기준입니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: /이전 기준 보기/ })).toBeVisible();
  await expect(page.locator(".feedback-memory-summary")).toHaveCount(0);

  const resetState = await page.evaluate(() => JSON.parse(window.localStorage.getItem("reman:onboarding") ?? "{}"));

  expect(resetState.image).toBeUndefined();
  expect(resetState.feedback).toBeUndefined();
  expect(resetState.closet_items[0].id).toBe("repeat-top");
  expect(resetState.recommendation_feedback.note).toBe("셔츠 방향 유지");
  expect(resetState.feedback_history[0].summary).toContain("이전 체크 진단");
});

test("profile can start a fresh photo check without losing closet context", async ({ page }) => {
  const uploadedImage = `data:image/png;base64,${tinyPng.buffer.toString("base64")}`;

  await page.addInitScript(({ outfit, uploadedImage }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        user_id: "e2e-try-on-user",
        email: "try-on@example.com",
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원",
          style_goal: "전체적인 스타일 리셋",
          confidence_level: "배우는 중"
        },
        closet_profile: {
          tops: "무지 티셔츠, 후드티",
          bottoms: "청바지, 검정 슬랙스",
          shoes: "흰색 스니커즈"
        },
        image: uploadedImage,
        feedback: {
          diagnosis: "이전 스타일 체크 진단",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: outfit,
          today_action: "오늘은 상의 길이를 비교해보세요.",
          day1_mission: "옷장 조합을 확인해보세요."
        },
        recommendation_feedback: {
          reaction: "helpful",
          note: "셔츠 방향이 좋음",
          outfit_title: "이전 추천",
          created_at: "2026-04-15T00:00:00.000Z"
        },
        deep_dive_feedbacks: {
          fit: {
            title: "핏 체크",
            diagnosis: "기장 점검",
            focus_points: ["상의 길이"],
            recommendation: "상의 끝을 확인하세요.",
            action: "거울 앞에서 비교하기"
          }
        },
        try_on_previews: {
          cached_preview: {
            cache_key: "cached_preview",
            source: "reference",
            reference_id: "recommended",
            prompt: outfit.try_on_prompt,
            provider: "vertex",
            preview_image: uploadedImage,
            message: "저장된 실착 결과",
            created_at: "2026-04-14T00:00:00.000Z"
          }
        }
      })
    );
  }, { outfit: recommendedOutfit, uploadedImage });

  await addTryOnSession(page);
  await page.goto("/profile");
  await page.getByRole("link", { name: /새 체크/ }).click();

  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/upload$/);
  await expect(page.getByRole("heading", { name: "사진이 기준입니다" })).toBeVisible();
  await expect(page.getByText("사진 선택", { exact: true })).toBeVisible();
  await expect(page.getByText("카메라 촬영", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 분석 시작하기" })).toBeDisabled();
  await expect(
    page.getByRole("region", { name: "분석 준비 상태" }).getByText("상의, 하의, 신발 준비됨")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /이전 기준 보기/ })).toBeVisible();
  await expect(page.locator(".feedback-memory-summary")).toHaveCount(0);
  await page.getByRole("button", { name: /이전 기준 보기/ }).click();
  const uploadMemory = page.locator(".feedback-memory-summary").first();
  await expect(uploadMemory.getByText("다음 추천 기준", { exact: true })).toBeVisible();
  await expect(uploadMemory.getByText("좋아한 방향")).toBeVisible();
  await expect(uploadMemory.getByText("이전 추천")).toBeVisible();

  const resetState = await page.evaluate(() => JSON.parse(window.localStorage.getItem("reman:onboarding") ?? "{}"));

  expect(resetState.image).toBeUndefined();
  expect(resetState.feedback).toBeUndefined();
  expect(resetState.deep_dive_feedbacks).toEqual({});
  expect(resetState.try_on_previews).toEqual({});
  expect(resetState.feedback_history[0].summary).toContain("이전 스타일 체크 진단");

  await page.locator("#photo-upload").setInputFiles(tinyPng);
  const feedbackResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/feedback") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "AI 분석 시작하기" }).click();
  const feedbackResponse = await feedbackResponsePromise;
  const feedbackPayload = feedbackResponse.request().postDataJSON();

  expect(feedbackPayload.feedback_history[0].summary).toContain("이전 스타일 체크 진단");
  expect(feedbackPayload.preference_profile).toMatchObject({
    liked_direction: "이전 추천 방향 선호",
    note: "셔츠 방향이 좋음",
    last_reaction: "helpful"
  });
});

test("settings saves style profile into the next analysis context", async ({ page }) => {
  await page.addInitScript(({ uploadedImage }) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "직장 이미지 변화",
          budget: "15~30만원",
          style_goal: "",
          confidence_level: ""
        },
        closet_items: [
          {
            id: "settings-top",
            category: "tops",
            name: "네이비 셔츠",
            photo_data_url: uploadedImage,
            size: "L",
            wear_state: "잘 맞음"
          },
          {
            id: "settings-bottom",
            category: "bottoms",
            name: "검정 슬랙스",
            photo_data_url: uploadedImage,
            size: "32"
          },
          {
            id: "settings-shoes",
            category: "shoes",
            name: "검정 로퍼",
            photo_data_url: uploadedImage,
            size: "270"
          },
          {
            id: "settings-outerwear",
            category: "outerwear",
            name: "차콜 자켓",
            photo_data_url: uploadedImage
          }
        ]
      })
    );
  }, { uploadedImage: `data:image/png;base64,${tinyPng.buffer.toString("base64")}` });

  await addTryOnSession(page, "e2e-settings-feedback-user");
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { name: "설정" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "다음 체크에 쓸 기준" })).toBeVisible();

  await page.getByPlaceholder("예: 소개팅 전에 단정한 인상 만들기").fill("면접 전 단정한 인상");
  await page.getByLabel("Confidence").selectOption("조금 자신 있음");
  await expect(page.getByText("옷장 4개")).toBeVisible();
  await expect(page.getByRole("link", { name: "옷장 관리" })).toHaveAttribute("href", "/closet");
  await expect(page.getByRole("button", { name: "옷 추가", exact: true })).toHaveCount(0);
  await page.getByPlaceholder("피하고 싶은 핏, 색, 아이템").fill("너무 큰 후드티");
  await page.getByRole("button", { name: "정보 저장" }).click();
  await expect(page.getByText("저장되었습니다.")).toBeVisible();
  const settingsState = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("reman:onboarding") ?? "{}")
  );
  expect(settingsState.survey.style_goal).toBe("면접 전 단정한 인상");
  expect(settingsState.survey.confidence_level).toBe("조금 자신 있음");
  expect(settingsState.closet_profile.avoid).toBe("너무 큰 후드티");

  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "직장 이미지 변화" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();
  const afterSurveyState = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("reman:onboarding") ?? "{}")
  );
  expect(afterSurveyState.survey.style_goal).toBe("면접 전 단정한 인상");
  expect(afterSurveyState.survey.confidence_level).toBe("조금 자신 있음");
  await page.locator("#photo-upload").setInputFiles(tinyPng);
  await page.getByRole("button", { name: "수정" }).click();
  await page.getByRole("button", { name: /상의.*열기/ }).click();
  await expect(page.getByText("네이비 셔츠")).toBeVisible();
  await page.getByRole("button", { name: /하의.*열기/ }).click();
  await expect(page.getByText("검정 슬랙스")).toBeVisible();
  await page.getByRole("button", { name: /신발.*열기/ }).click();
  await expect(page.getByText("검정 로퍼")).toBeVisible();

  const onboardingResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/feedback") && response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "AI 분석 시작하기" }).click();
  const onboardingResponse = await onboardingResponsePromise;
  const onboardingPayload = onboardingResponse.request().postDataJSON();

  expect(onboardingPayload.survey.style_goal).toBe("면접 전 단정한 인상");
  expect(onboardingPayload.survey.confidence_level).toBe("조금 자신 있음");
  expect(onboardingPayload.closet_profile.tops).toContain("네이비 셔츠");
  expect(onboardingPayload.closet_profile.tops).toContain("[L]");
  expect(onboardingPayload.closet_profile.tops).toContain("{잘 맞음}");
  expect(onboardingPayload.closet_profile.bottoms).toContain("검정 슬랙스");
  expect(onboardingPayload.closet_profile.bottoms).toContain("[32]");
  expect(onboardingPayload.closet_profile.shoes).toContain("검정 로퍼");
  expect(onboardingPayload.closet_profile.shoes).toContain("[270]");
  expect(onboardingPayload.closet_profile.outerwear).toBe("차콜 자켓");
  expect(onboardingPayload.closet_profile.avoid).toBe("너무 큰 후드티");
});
