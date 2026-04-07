import { expect, test } from "@playwright/test";

test("onboarding flow surfaces the documented pages", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "지금 모습 그대로, 1주일만 맡겨봐" })
  ).toBeVisible();

  await page.getByRole("link", { name: "지금 시작하기" }).click();
  await expect(page).toHaveURL(/\/onboarding\/survey$/);
  await expect(
    page.getByRole("heading", { name: "지금 스타일이 어때요?" })
  ).toBeVisible();

  await page.getByRole("link", { name: "사진 업로드로 이동" }).click();
  await expect(page).toHaveURL(/\/onboarding\/upload$/);
  await expect(
    page.getByRole("heading", { name: "지금 입고 있는 옷 그대로 찍어주세요" })
  ).toBeVisible();

  await page.getByRole("link", { name: "AI 분석 시작하기" }).click();
  await expect(page).toHaveURL(/\/onboarding\/analyzing$/);
  await expect(page.getByText("핏을 분석하는 중...")).toBeVisible();

  await page.getByRole("link", { name: "데모 결과 보기" }).click();
  await expect(page).toHaveURL(/\/onboarding\/result$/);
  await expect(
    page.getByRole("heading", { name: "첫 피드백은 칭찬보다 방향을 먼저 줍니다" })
  ).toBeVisible();
});
