import { expect, test } from "@playwright/test";

test("onboarding flow captures input and renders feedback", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "지금 모습 그대로, 1주일만 맡겨봐" })
  ).toBeVisible();

  await page.getByRole("link", { name: "지금 시작하기" }).click();
  await expect(page).toHaveURL(/\/onboarding\/survey$/);
  await expect(
    page.getByRole("heading", { name: "지금 스타일이 어때요?" })
  ).toBeVisible();

  await page.getByRole("button", { name: "청바지 + 무지 티셔츠" }).click();
  await page.getByRole("button", { name: "소개팅 / 이성 만남" }).click();
  await page.getByRole("button", { name: "15~30만원" }).click();
  await page.getByRole("button", { name: "사진 업로드로 이동" }).click();
  await expect(page).toHaveURL(/\/onboarding\/upload$/);
  await expect(
    page.getByRole("heading", { name: "지금 입고 있는 옷 그대로 찍어주세요" })
  ).toBeVisible();

  await page.getByRole("button", { name: "오늘 입은 옷 설명하기" }).click();
  await page
    .getByLabel("오늘 입은 옷 설명")
    .fill("검은 후드티, 중청 와이드 데님, 회색 운동화");
  await page.getByRole("button", { name: "AI 분석 시작하기" }).click();
  await expect(page).toHaveURL(/\/onboarding\/analyzing$/);
  await expect(page.getByText("핏을 분석하는 중...")).toBeVisible();

  await page.waitForURL(/\/onboarding\/result$/);
  await expect(
    page.getByRole("heading", { name: "첫 피드백은 칭찬보다 방향을 먼저 줍니다" })
  ).toBeVisible();
  await expect(page.getByText("청바지 + 무지 티셔츠 중심의 코디라")).toBeVisible();
});
