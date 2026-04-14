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
  await expect(page.getByRole("heading", { name: "더 보고 싶은 것만 고르세요" })).toBeVisible();
  const fitCheckResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/deep-dive") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: /핏 더 보기/ }).click();
  const fitCheckResponse = await fitCheckResponsePromise;
  expect(fitCheckResponse.ok()).toBeTruthy();
  const fitCheckPayload = fitCheckResponse.request().postDataJSON();
  expect(fitCheckPayload.module).toBe("fit");
  expect(fitCheckPayload.current_feedback.recommended_outfit.title).toBe(
    "지금 가진 옷으로 만드는 깔끔한 기본 조합"
  );
  await expect(page.getByRole("heading", { name: "핏 체크" })).toBeVisible();
  await expect(page.getByText("상의 끝이 골반을 너무 많이 덮으면")).toBeVisible();
  const colorCheckResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/deep-dive") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: /색 조합 보기/ }).click();
  const colorCheckResponse = await colorCheckResponsePromise;
  expect(colorCheckResponse.ok()).toBeTruthy();
  const colorCheckPayload = colorCheckResponse.request().postDataJSON();
  expect(colorCheckPayload.module).toBe("color");
  await expect(page.getByText("Color Check")).toBeVisible();
  await expect(page.getByRole("heading", { name: "색 조합 체크" })).toBeVisible();
  const occasionCheckResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/deep-dive") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: /상황별 코디/ }).click();
  const occasionCheckResponse = await occasionCheckResponsePromise;
  expect(occasionCheckResponse.ok()).toBeTruthy();
  const occasionCheckPayload = occasionCheckResponse.request().postDataJSON();
  expect(occasionCheckPayload.module).toBe("occasion");
  await expect(page.getByText("Occasion Check")).toBeVisible();
  await expect(page.getByRole("heading", { name: "상황별 코디 체크" })).toBeVisible();
  const closetCheckResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/deep-dive") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: /내 옷장 다른 조합/ }).click();
  const closetCheckResponse = await closetCheckResponsePromise;
  expect(closetCheckResponse.ok()).toBeTruthy();
  const closetCheckPayload = closetCheckResponse.request().postDataJSON();
  expect(closetCheckPayload.module).toBe("closet");
  expect(closetCheckPayload.closet_profile.tops).toContain("무지 티셔츠");
  await expect(page.getByText("Closet Remix")).toBeVisible();
  await expect(page.getByRole("heading", { name: "내 옷장 다른 조합" })).toBeVisible();
  await expect(page.getByRole("link", { name: "원하면 루틴 모드로 이어가기" })).toBeVisible();
  await page.getByRole("link", { name: "결과 저장하고 홈으로" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "최근 스타일 체크 결과에서 바로 이어가면 됩니다" })
  ).toBeVisible();
  await expect(page.getByText("최근 스타일 체크 결과가 저장되어 있습니다.")).toBeVisible();
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
  await page.getByRole("button", { name: /새 스타일 체크 시작하기/ }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/upload$/);
  await expect(page.getByRole("heading", { name: "사진이 이번 체크의 기준입니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 분석 시작하기" })).toBeDisabled();
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
  await page.getByRole("link", { name: "원하면 루틴 모드로 이어가기" }).click();
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
    page.getByRole("heading", { name: "최근 스타일 체크 결과에서 바로 이어가면 됩니다" })
  ).toBeVisible();
  await expect(page.getByText("최근 스타일 체크 결과가 저장되어 있습니다.")).toBeVisible();
  await expect(page.getByRole("link", { name: "프로그램 보기" })).toBeVisible();
  await page.getByRole("link", { name: "최근 스타일 체크 보기" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/result$/);
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
    page.getByRole("heading", { name: "결과를 다시 보고, 다음 선택을 고르면 됩니다" })
  ).toBeVisible();
  await expect(page.getByText("루틴 기록이 있더라도 기본 복귀는 최근 스타일 체크 결과입니다.")).toBeVisible();
  await expect(
    page.getByText("최근 스타일 체크 결과를 다시 보거나, 다른 프로그램을 고르면서 다음 변화를 시작할 수 있습니다.")
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "다른 프로그램 보기" })).toBeVisible();
  await page.getByRole("link", { name: "최근 스타일 체크 보기" }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/result$/);
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
        feedback: {
          diagnosis: "최근 스타일 체크 진단",
          improvements: ["핏", "색", "신발"],
          recommended_outfit: outfit,
          today_action: "오늘은 상의 길이를 비교해보세요.",
          day1_mission: "옷장 조합을 확인해보세요."
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
    page.getByRole("heading", { name: "계정과 프로그램 상태를 한 곳에서 봅니다" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "기본 조합" })).toBeVisible();
  await expect(page.getByText("상의 무지 티셔츠, 후드티")).toBeVisible();
  await expect(page.getByText("Day 1: 최근 스타일 체크 진단")).toBeVisible();
  await page.getByRole("link", { name: /최근 스타일 체크 보기/ }).click();
  await expect(page).toHaveURL(/\/programs\/style\/onboarding\/result$/);
});

test("settings saves style profile into the next analysis context", async ({ page }) => {
  await addTryOnSession(page);
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { name: "계정에 붙일 기본 정보를 정리합니다" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "다음 체크에 쓸 기준" })).toBeVisible();

  await page.getByPlaceholder("예: 소개팅 전에 단정한 인상 만들기").fill("면접 전 단정한 인상");
  await page.getByLabel("Confidence").selectOption("조금 자신 있음");
  await page.getByPlaceholder("무지 티셔츠, 셔츠").fill("네이비 셔츠");
  await page.getByPlaceholder("청바지, 검정 슬랙스").fill("검정 슬랙스");
  await page.getByPlaceholder("흰색 스니커즈").fill("검정 로퍼");
  await page.getByPlaceholder("셔츠, 가디건, 자켓").fill("차콜 자켓");
  await page.getByPlaceholder("피하고 싶은 핏, 색, 아이템").fill("너무 큰 후드티");
  await page.getByRole("button", { name: "정보 저장" }).click();
  await expect(page.getByText("저장되었습니다.")).toBeVisible();

  await page.goto("/programs/style/onboarding/survey");
  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "직장 이미지 변화" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();
  await page.locator("#photo-upload").setInputFiles(tinyPng);
  await expect(page.locator('input[value="네이비 셔츠"]')).toBeVisible();
  await expect(page.locator('input[value="검정 슬랙스"]')).toBeVisible();
  await expect(page.locator('input[value="검정 로퍼"]')).toBeVisible();

  const onboardingResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/feedback") && response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "AI 분석 시작하기" }).click();
  const onboardingResponse = await onboardingResponsePromise;
  const onboardingPayload = onboardingResponse.request().postDataJSON();

  expect(onboardingPayload.survey.style_goal).toBe("면접 전 단정한 인상");
  expect(onboardingPayload.survey.confidence_level).toBe("조금 자신 있음");
  expect(onboardingPayload.closet_profile.tops).toBe("네이비 셔츠");
  expect(onboardingPayload.closet_profile.bottoms).toBe("검정 슬랙스");
  expect(onboardingPayload.closet_profile.shoes).toBe("검정 로퍼");
  expect(onboardingPayload.closet_profile.outerwear).toBe("차콜 자켓");
  expect(onboardingPayload.closet_profile.avoid).toBe("너무 큰 후드티");
});
