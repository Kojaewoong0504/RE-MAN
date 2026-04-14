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

async function fillClosetSnapshot(page: import("@playwright/test").Page) {
  await page.getByLabel("자주 입는 상의").fill("무지 티셔츠, 후드티");
  await page.getByLabel("자주 입는 하의").fill("청바지, 검정 슬랙스");
  await page.getByLabel("자주 신는 신발").fill("흰색 스니커즈");
}

async function fillUploadContext(page: import("@playwright/test").Page) {
  await fillClosetSnapshot(page);
  await page.getByRole("button", { name: /전체적인 스타일 리셋/ }).click();
  await page.getByRole("button", { name: "배우는 중" }).click();
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
    page.getByRole("heading", { name: "판단 없이, 변화를 시작하게 만드는 코치" })
  ).toBeVisible();

  await page.getByRole("link", { name: "프로그램 보기" }).click();
  await expect(page).toHaveURL(/\/programs$/);
  await page.getByRole("link", { name: "스타일" }).click();
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
    page.getByRole("heading", { name: "사진이 이번 체크의 기준입니다" })
  ).toBeVisible();

  await page.locator("#photo-upload").setInputFiles(tinyPng);
  await fillUploadContext(page);

  const onboardingResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/feedback") && response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "AI 분석 시작하기" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/analyzing$/);
  await expect(page.getByText("핏을 분석하는 중...")).toBeVisible();

  const onboardingResponse = await onboardingResponsePromise;
  expect(onboardingResponse.ok()).toBeTruthy();
  const onboardingPayload = onboardingResponse.request().postDataJSON();
  expect(typeof onboardingPayload.image).toBe("string");
  expect(onboardingPayload.image.startsWith("data:image/jpeg;base64,")).toBeTruthy();
  expect(onboardingPayload.closet_profile.tops).toContain("무지 티셔츠");
  expect(onboardingPayload.survey.style_goal).toBe("전체적인 스타일 리셋");
  expect(onboardingPayload.survey.confidence_level).toBe("배우는 중");

  await page.waitForURL(/\/programs\/style\/onboarding\/result$/);
  await expect(
    page.getByRole("heading", { name: "지금 사진에서 시작점을 잡았습니다" })
  ).toBeVisible();
  await expect(page.getByText("청바지 + 무지 티셔츠 중심의 코디라")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "지금 가진 옷으로 만드는 깔끔한 기본 조합" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "추천 조합을 눈으로 확인합니다" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "로그인하고 실착 미리보기 사용하기" })
  ).toBeVisible();
  await addTryOnSession(page);
  await page.getByRole("button", { name: /추천 조합 그대로/ }).click();
  await expect(page.getByAltText("업로드한 상품 이미지")).toBeVisible();
  await expect(page.getByRole("button", { name: "실제 실착 생성 비활성화" })).toBeDisabled();
  await expect(page.getByText("현재는 실제 실착 생성이 아니라")).toBeVisible();
  await page.getByRole("link", { name: "Day 1 미션 시작하기" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/day\/1$/);
  await expect(page.getByText("오늘 미션 하나만 끝내면 됩니다")).toBeVisible();
  await page.getByRole("link", { name: "Day 2 피드백 시작하기" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/day\/2$/);
  await expect(
    page.getByText("어제 피드백에서 가장 쉬운 한 가지만 반영해서 다시 올려보세요.")
  ).toBeVisible();

  const dailyResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/daily") && response.request().method() === "POST"
  );

  await page.locator("#photo-upload").setInputFiles(tinyPng);
  await page.getByRole("button", { name: "오늘 피드백 받기" }).click();

  const dailyResponse = await dailyResponsePromise;
  expect(dailyResponse.ok()).toBeTruthy();
  const dailyPayload = dailyResponse.request().postDataJSON();
  expect(typeof dailyPayload.image).toBe("string");
  expect(dailyPayload.image.startsWith("data:image/jpeg;base64,")).toBeTruthy();
  await expect(
    page.getByText(
      "Day 1보다 오늘 코디가 더 정돈돼 보이고, 핵심 아이템이 눈에 더 잘 들어옵니다.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    page.getByText("내일은 오늘 코디에서 딱 한 가지만 바꿔볼게요.", {
      exact: true
    })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Day 3로 이동" })).toBeVisible();

  for (const nextDay of [3, 4, 5, 6, 7]) {
    await page.getByRole("link", { name: `Day ${nextDay}로 이동` }).click();
    await expect(page).toHaveURL(new RegExp(`/programs/style/day/${nextDay}$`));

    const nextResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/daily") && response.request().method() === "POST"
    );

    await page.locator("#photo-upload").setInputFiles(tinyPng);
    await page.getByRole("button", { name: "오늘 피드백 받기" }).click();

    const nextResponse = await nextResponsePromise;
    expect(nextResponse.ok()).toBeTruthy();

    if (nextDay < 7) {
      await expect(page.getByRole("link", { name: `Day ${nextDay + 1}로 이동` })).toBeVisible();
    }
  }

  await expect(page.getByRole("heading", { name: "7일 피드백을 끝냈습니다" })).toBeVisible();
  await expect(page.getByText("완료한 일수 7/7일")).toBeVisible();
  await expect(page.getByText("Before Day 1")).toBeVisible();
  await expect(page.getByText("After Day 7")).toBeVisible();
  await expect(page.getByText("Keep This Going")).toBeVisible();
  await expect(page.getByRole("button", { name: "온보딩 결과 다시 보기" })).toBeVisible();
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

test("try-on explains the limitation when onboarding used text instead of a photo", async ({ page }) => {
  await page.addInitScript((outfit) => {
    window.localStorage.setItem(
      "reman:onboarding",
      JSON.stringify({
        survey: {
          current_style: "청바지 + 무지 티셔츠",
          motivation: "소개팅 / 이성 만남",
          budget: "15~30만원"
        },
        closet_profile: {
          tops: "무지 티셔츠",
          bottoms: "청바지",
          shoes: "흰색 스니커즈"
        },
        text_description: "무지 티셔츠, 청바지, 흰색 스니커즈",
        feedback: {
          diagnosis: "텍스트 설명 기반 피드백",
          improvements: ["a", "b", "c"],
          recommended_outfit: outfit,
          today_action: "오늘 바로 할 것",
          day1_mission: "Day 1 미션"
        }
      })
    );
  }, recommendedOutfit);

  await page.goto("/programs/style/onboarding/result");
  await expect(page.getByRole("heading", { name: "추천 조합을 눈으로 확인합니다" })).toBeVisible();
  await expect(
    page.getByText("텍스트 설명으로 진행한 경우 실착 미리보기를 만들 수 없습니다.")
  ).toBeVisible();
  await expect(page.locator("#try-on-product-upload")).toHaveCount(0);
});

test("day flow shows fallback when storage delete fails", async ({ page }) => {
  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();
  await page.locator("#photo-upload").setInputFiles(tinyPng);
  await fillUploadContext(page);
  await page.getByRole("button", { name: "AI 분석 시작하기" }).click();
  await page.waitForURL(/\/programs\/style\/onboarding\/result$/);
  await page.getByRole("link", { name: "Day 1 미션 시작하기" }).click();
  await page.getByRole("link", { name: "Day 2 피드백 시작하기" }).click();

  await page.route("**/api/daily", async (route) => {
    const headers = {
      ...route.request().headers(),
      "x-harness-storage-failure-mode": "delete"
    };

    await route.continue({ headers });
  });

  await page.locator("#photo-upload").setInputFiles(tinyPng);
  await page.getByRole("button", { name: "오늘 피드백 받기" }).click();

  await expect(
    page.getByText("지금 사진 분석이 잠깐 어려운 상황이에요.")
  ).toBeVisible();
});

test("home shows resume branch for active style user", async ({ page }) => {
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
    page.getByRole("heading", { name: "지금 하던 변화를 바로 이어가면 됩니다" })
  ).toBeVisible();
  await expect(page.getByText("스타일 프로그램 Day 3 진행 중")).toBeVisible();
  await expect(page.getByRole("link", { name: "프로그램 보기" })).toBeVisible();
  await page.getByRole("link", { name: "스타일 이어서 하기" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/day\/3$/);
});

test("home shows completed branch for finished style user", async ({ page }) => {
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
    page.getByRole("heading", { name: "한 프로그램을 끝냈다면, 다음 선택만 남았습니다" })
  ).toBeVisible();
  await expect(page.getByText("스타일 7일 프로그램을 완료했습니다.")).toBeVisible();
  await expect(
    page.getByText("스타일 완료 내용을 다시 보거나, 다른 프로그램을 고르면서 다음 변화를 시작할 수 있습니다.")
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "다른 프로그램 보기" })).toBeVisible();
  await page.getByRole("link", { name: "스타일 완료 내용 보기" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/day\/7$/);
});

test("program hub opens coming soon program placeholder", async ({ page }) => {
  await page.goto("/programs");
  await page.getByRole("link", { name: "헤어" }).click();
  await expect(page).toHaveURL(/\/programs\/hair$/);
  await expect(page.getByRole("heading", { name: "헤어" })).toBeVisible();
  await expect(page.getByText("지금은 스타일 프로그램이 먼저 열려 있습니다")).toBeVisible();
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
