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

async function fillClosetSnapshot(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await page.locator("#closet-photo-upload").setInputFiles(tinyPng);
  await page.getByLabel("종류").selectOption("tops");
  await page.getByLabel("아이템 이름").fill("무지 티셔츠");
  await page.getByLabel("색").fill("흰색");
  await page.getByLabel("핏").fill("레귤러");
  await page.getByLabel("사이즈").fill("L");
  await page.getByLabel("착용감").selectOption("잘 맞음");
  await page.getByRole("button", { name: /사진을 옷장에 추가/ }).click();
  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await page.locator("#closet-photo-upload").setInputFiles(tinyPng);
  await page.getByLabel("종류").selectOption("bottoms");
  await page.getByLabel("아이템 이름").fill("검정 슬랙스");
  await page.getByLabel("색").fill("검정");
  await page.getByLabel("사이즈").fill("32");
  await page.getByRole("button", { name: /사진을 옷장에 추가/ }).click();
  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await page.locator("#closet-photo-upload").setInputFiles(tinyPng);
  await page.getByLabel("종류").selectOption("shoes");
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

async function addTryOnSession(page: import("@playwright/test").Page) {
  process.env.AUTH_JWT_SECRET = "e2e-auth-secret";
  const { accessToken } = await issueSessionTokens(
    {
      uid: "e2e-try-on-user",
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

test("onboarding flow captures input and renders feedback", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "관리 홈" })
  ).toBeVisible();

  await page.getByRole("link", { name: "스타일 체크 시작 →" }).click();
  await expect(page).toHaveURL(/\/programs\/style$/);
  await page.getByRole("link", { name: "스타일 프로그램 시작하기" }).click();
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
  await fillUploadContext(page);

  const onboardingResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/feedback") && response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "AI 분석 시작하기" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/(analyzing|result)$/);
  if (page.url().endsWith("/analyzing")) {
    await expect(page.getByText("핏을 분석하는 중...")).toBeVisible();
  }

  const onboardingResponse = await onboardingResponsePromise;
  expect(onboardingResponse.ok()).toBeTruthy();
  const onboardingPayload = onboardingResponse.request().postDataJSON();
  expect(typeof onboardingPayload.image).toBe("string");
  expect(onboardingPayload.image.startsWith("data:image/jpeg;base64,")).toBeTruthy();
  expect(onboardingPayload.closet_profile.tops).toContain("흰색 무지 티셔츠");
  expect(onboardingPayload.closet_profile.tops).toContain("[L]");
  expect(onboardingPayload.closet_profile.tops).toContain("{잘 맞음}");
  expect(onboardingPayload.closet_items[0]).not.toHaveProperty("photo_data_url");
  expect(onboardingPayload.survey.style_goal).toBe("전체적인 스타일 리셋");
  expect(onboardingPayload.survey.confidence_level).toBe("배우는 중");

  await page.waitForURL(/\/programs\/style\/onboarding\/result$/);
  await expect(
    page.getByRole("heading", { name: "오늘 바꿀 조합만 먼저 봅니다" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "내 옷장 근거" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "흰색 무지 티셔츠" })).toBeVisible();
  await expect(page.getByText(/직접 매칭|근거 후보/).first()).toBeVisible();
  const resultActionDock = page.getByLabel("다음 행동");
  await expect(resultActionDock.getByRole("link", { name: "옷장" })).toBeVisible();
  await expect(resultActionDock.getByRole("link", { name: "기록" })).toBeVisible();
  await expect(resultActionDock.getByRole("button", { name: "새 체크" })).toBeVisible();
  await expect(page.getByRole("link", { name: "크레딧 확인" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /핏 더 보기/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /레퍼런스\/실착 보기/ })).toHaveCount(0);
  await expect(page.getByText("청바지 + 무지 티셔츠 중심의 코디라")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "지금 가진 옷으로 만드는 깔끔한 기본 조합" })
  ).toBeVisible();
  await page.getByRole("button", { name: /바꿀 점 3개 보기/ }).click();
  await expect(page.getByText("바지 핏을 조금 더 곧게 잡으면")).toBeVisible();
  await page.getByRole("button", { name: /추천 반응 남기기/ }).click();
  await expect(page.getByRole("heading", { name: "이 추천이 도움이 됐나요?" })).toBeVisible();
  await page.getByRole("button", { name: /도움됨/ }).click();
  await page.getByPlaceholder("예: 셔츠 조합은 좋은데 신발은 애매했어요.").fill("셔츠 방향이 좋았어요.");
  await page.getByRole("button", { name: "추천 반응 저장" }).click();
  await expect(page.getByRole("button", { name: /도움됨 저장됨/ })).toBeVisible();
  await expect(page.getByText("다음 스타일 체크에 이 반응을 함께 반영합니다.")).toBeVisible();
  const recommendationFeedbackState = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("reman:onboarding") ?? "{}")
  );
  expect(recommendationFeedbackState.recommendation_feedback.reaction).toBe("helpful");
  expect(recommendationFeedbackState.recommendation_feedback.note).toContain("셔츠 방향");
  expect(recommendationFeedbackState.feedback_history[0].summary).toContain("내 반응: 도움됨");
  expect(recommendationFeedbackState.feedback_history[0].summary).toContain("셔츠 방향");
  await expect(page.getByText(/^provider:/)).toHaveCount(0);
  await expect(page.getByText(/^개발 설정 누락:/)).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "오늘 바꿀 조합만 먼저 봅니다" })
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
  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();

  await page.locator("#photo-upload").setInputFiles(invalidGif);
  await expect(page.getByText("PNG, JPG, WEBP 이미지만 업로드할 수 있습니다.")).toBeVisible();

  await page.getByRole("button", { name: "사진 없이 옷 설명으로 진행하기" }).click();
  await fillUploadContext(page);
  await page.getByLabel("오늘 입은 옷 설명").fill("짧음");
  await expect(page.getByText("현재 2자입니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 분석 시작하기" })).toBeDisabled();

  await page.getByLabel("오늘 입은 옷 설명").fill("검정 후드티와 청바지를 입었어요");
  await expect(page.getByRole("button", { name: "AI 분석 시작하기" })).toBeEnabled();
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
          today_action: "오늘 바로 할 것",
          day1_mission: "루틴 미션"
        },
        feedback_history: [{ day: 1, summary: "긴 기록" }]
      })
    );
  }, { outfit: recommendedOutfit, uploadedImage });

  await page.goto("/programs/style/onboarding/result");
  await page.getByRole("button", { name: "새 체크" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/upload$/);
  await expect(page.getByRole("heading", { name: "사진이 기준입니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 분석 시작하기" })).toBeDisabled();
});

test("saved result hides non-MVP generation actions", async ({ page }) => {
  let deepDiveRequests = 0;
  let tryOnRequests = 0;
  let creditRequests = 0;

  await page.route("**/api/deep-dive", async (route) => {
    deepDiveRequests += 1;
    await route.abort();
  });
  await page.route("**/api/try-on", async (route) => {
    tryOnRequests += 1;
    await route.abort();
  });
  await page.route("**/api/credits", async (route) => {
    creditRequests += 1;
    await route.abort();
  });
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
        size_profile: {
          top_size: "L",
          bottom_size: "32",
          shoe_size_mm: "270",
          fit_preference: "너무 붙지 않게"
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

  await page.goto("/programs/style/onboarding/result");
  await expect(
    page.getByRole("heading", { name: "오늘 바꿀 조합만 먼저 봅니다" })
  ).toBeVisible();
  await expect(page.getByText("텍스트 기준")).toBeVisible();
  await expect(page.getByRole("button", { name: /색 조합 보기/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /핏 더 보기/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /레퍼런스\/실착 보기/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /크레딧 확인/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "사이즈 체크 후보" })).toBeVisible();
  await expect(page.getByText("사용자가 입력한 평소 사이즈 기준입니다.")).toBeVisible();
  await expect(page.getByText("내부 기준 후보").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /구매/ })).toHaveCount(0);
  expect(deepDiveRequests).toBe(0);
  expect(tryOnRequests).toBe(0);
  expect(creditRequests).toBe(0);
});

test("result explains how to unlock size candidates when size profile is missing", async ({ page }) => {
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

  await expect(page.getByRole("heading", { name: "사이즈 체크 후보" })).toBeVisible();
  await expect(page.getByText("사이즈 정보를 추가하면 후보를 좁힐 수 있습니다.")).toBeVisible();
  const sizeSettingsLink = page.getByRole("link", { name: "사이즈 추가하기" });
  await expect(sizeSettingsLink).toBeVisible();
  await expect(sizeSettingsLink).toHaveAttribute(
    "href",
    "/settings#size-profile"
  );
  await expect(page.getByRole("link", { name: /구매/ })).toHaveCount(0);
  await sizeSettingsLink.click();
  await expect(page).toHaveURL(/\/settings#size-profile$/);
  await expect(page.getByRole("heading", { name: "평소 사이즈를 기준으로 남깁니다" })).toBeVisible();
});

test("onboarding shows fallback when storage upload fails", async ({ page }) => {
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

test("onboarding shows a specific message when feedback is rate limited", async ({ page }) => {
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

test("try-on rejects unauthenticated requests", async ({ request }) => {
  const response = await request.post("/api/try-on", {
    data: {
      person_image: `data:image/png;base64,${tinyPng.buffer.toString("base64")}`,
      product_image: `data:image/png;base64,${tinyPng.buffer.toString("base64")}`,
      prompt: "전신 정면 사진 기준 자연스러운 실착 미리보기"
    }
  });

  expect(response.status()).toBe(401);
});

test("signed-in users can attach a local result to their account from result page", async ({ page }) => {
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
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        }
      })
    );
  }, { outfit: recommendedOutfit, uploadedImage });

  await page.goto("/programs/style/onboarding/result");
  await page.getByRole("button", { name: /계정 저장 열기/ }).click();
  await expect(page.getByRole("heading", { name: "결과를 계정에 저장합니다" })).toBeVisible();
  await page.getByRole("button", { name: /계정에 결과 저장/ }).click();

  await expect(
    page.getByRole("button", { name: /계정 저장 완료|계정에 결과 저장/ })
  ).toBeVisible();

  const savedState = await page.evaluate(() => JSON.parse(window.localStorage.getItem("reman:onboarding") ?? "{}"));

  expect(savedState.user_id).toBe("e2e-try-on-user");
  expect(savedState.email).toBe("try-on@example.com");
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

test("program hub opens coming soon program placeholder", async ({ page }) => {
  await page.goto("/programs");
  await page.getByRole("link", { name: "헤어" }).click();
  await expect(page).toHaveURL(/\/programs\/hair$/);
  await expect(page.getByRole("heading", { name: "헤어" })).toBeVisible();
  await expect(page.getByText("지금은 스타일 먼저.")).toBeVisible();
  await expect(page.getByRole("link", { name: "다른 프로그램으로 돌아가기" })).toBeVisible();
  await expect(page.getByRole("link", { name: "스타일 프로그램 먼저 시작하기" })).toBeVisible();
});

test("protected profile redirects to login when no session is present", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fprofile$/);
  await expect(
    page.getByRole("heading", { name: "진행한 변화와 계정을 함께 관리합니다" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();
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
  await page.locator("#closet-photo-upload").setInputFiles(tinyPng);
  await page.getByLabel("종류").selectOption("tops");
  await page.getByLabel("아이템 이름").fill("옥스포드 셔츠");
  await page.getByLabel("색").fill("하늘색");
  await page.getByLabel("핏").fill("레귤러");
  await page.getByLabel("사이즈").fill("L");
  await page.getByLabel("착용감").selectOption("잘 맞음");
  await page.getByRole("button", { name: /사진을 옷장에 추가/ }).click();

  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await page.locator("#closet-photo-upload").setInputFiles(tinyPng);
  await page.getByLabel("종류").selectOption("bottoms");
  await page.getByLabel("아이템 이름").fill("네이비 치노");
  await page.getByLabel("사이즈").fill("32");
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
  expect(savedState.closet_profile.tops).toContain("하늘색 옥스포드 셔츠");
  expect(savedState.closet_profile.tops).toContain("[L]");
  expect(savedState.closet_profile.tops).toContain("{잘 맞음}");
  expect(savedState.closet_profile.bottoms).toContain("네이비 치노");
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
  await expect(page.getByText("스타일", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("저장됨")).toBeVisible();
  await expect(page.getByText("최근 스타일 체크 진단")).toHaveCount(0);
  await expect(page.getByText("Saved Feedback")).toHaveCount(0);
  await expect(page.getByText("Deep Dive")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "기록 →" })).toBeVisible();
  await expect(page.getByRole("link", { name: "옷장 →" })).toBeVisible();
  await expect(page.getByRole("link", { name: /크레딧 확인/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /새 체크/ })).toBeVisible();
  await page.getByRole("link", { name: "기록 →" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { name: "기록" })).toBeVisible();
  await expect(page.getByText("불러오는 중")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "기본 조합" })).toBeVisible();
  await expect(page.getByText("도움됨 · 셔츠 방향이 좋음")).toBeVisible();
  await expect(page.getByText("핏 체크")).toBeVisible();
  await expect(page.getByText("Records")).toBeVisible();
  await page.getByRole("button", { name: /기본 조합/ }).click();
  await expect(page.getByText("추천 근거")).toBeVisible();
  await expect(page.getByText("네이비 셔츠")).toBeVisible();
  await expect(page.getByText("검정 슬랙스")).toBeVisible();
  await expect(page.getByText("흰색 스니커즈")).toBeVisible();
  await page.getByRole("link", { name: /최근 결과 보기/ }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/result$/);
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
  await expect(page.getByText("사진 선택하기")).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 분석 시작하기" })).toBeDisabled();
  await expect(page.getByText(/개 옷으로 추천합니다/)).toBeVisible();
  await expect(page.getByRole("button", { name: /이전 반응 반영/ })).toBeVisible();

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

  await addTryOnSession(page);
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
