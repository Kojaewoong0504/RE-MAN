#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { SignJWT } from "jose";

const baseUrl = process.env.VISUAL_SMOKE_BASE_URL ?? "http://127.0.0.1:3001";
const outputDir = "output/playwright/app-visual-smoke";
const jwtSecret = process.env.AUTH_JWT_SECRET ?? "visual-smoke-auth-secret";
const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s3FoX0AAAAASUVORK5CYII=";

const scenarios = [
  {
    id: "mobile",
    viewport: { width: 390, height: 844 }
  },
  {
    id: "desktop",
    viewport: { width: 768, height: 1024 }
  }
];

const pages = [
  {
    id: "home",
    path: "/",
    visibleText: "관리 홈"
  },
  {
    id: "style",
    path: "/programs/style",
    visibleText: "사진 올리고 조합 받기"
  },
  {
    id: "upload",
    path: "/programs/style/onboarding/upload",
    visibleText: "사진이 기준입니다"
  },
  {
    id: "result",
    path: "/programs/style/onboarding/result",
    visibleText: "오늘 바꿀 조합만 먼저 봅니다",
    expectedText: "사이즈 체크 후보",
    hiddenText: "구매하기"
  },
  {
    id: "closet",
    path: "/closet",
    visibleText: "옷장 저장",
    expectedText: "3",
    hiddenText: "옷장을 불러오는 중"
  },
  {
    id: "history",
    path: "/history",
    visibleText: "기록",
    hiddenText: "불러오는 중"
  },
  {
    id: "history-detail",
    path: "/history",
    visibleText: "기록",
    expectedTexts: ["추천 근거", "네이비 셔츠"],
    hiddenText: "불러오는 중",
    expandFirstHistoryCard: true
  },
  {
    id: "profile",
    path: "/profile",
    visibleText: "내 정보"
  },
  {
    id: "settings",
    path: "/settings#size-profile",
    visibleText: "평소 사이즈를 기준으로 남깁니다",
    expectedTexts: ["옷장 관리", "정보 저장"],
    hiddenTexts: ["옷 추가", "불러오는 중", "정보 불러오는 중"]
  }
];

const seededOutfit = {
  title: "네이비 셔츠와 검정 슬랙스",
  items: ["네이비 셔츠", "검정 슬랙스", "흰색 스니커즈"],
  reason: "지금 가진 옷 안에서 가장 단정하게 정리되는 조합입니다.",
  try_on_prompt: "전신 정면 사진 기준 네이비 셔츠, 검정 슬랙스, 흰색 스니커즈 실착"
};

const seededState = {
  survey: {
    current_style: "청바지 + 무지 티셔츠",
    motivation: "소개팅 / 이성 만남",
    budget: "15~30만원",
    style_goal: "전체적인 스타일 리셋",
    confidence_level: "배우는 중"
  },
  closet_profile: {
    tops: "네이비 셔츠, 무지 티셔츠",
    bottoms: "검정 슬랙스, 청바지",
    shoes: "흰색 스니커즈",
    outerwear: "차콜 자켓",
    avoid: ""
  },
  closet_items: [
    {
      id: "visual-top-1",
      category: "tops",
      name: "네이비 셔츠",
      photo_data_url: tinyPng,
      color: "네이비",
      fit: "레귤러",
      size: "L",
      wear_state: "잘 맞음"
    },
    {
      id: "visual-bottom-1",
      category: "bottoms",
      name: "검정 슬랙스",
      photo_data_url: tinyPng,
      color: "검정",
      fit: "스트레이트",
      size: "32",
      wear_state: "잘 맞음"
    },
    {
      id: "visual-shoes-1",
      category: "shoes",
      name: "흰색 스니커즈",
      photo_data_url: tinyPng,
      color: "흰색",
      size: "270",
      wear_state: "보통"
    }
  ],
  image: tinyPng,
  size_profile: {
    height_cm: "176",
    weight_kg: "72",
    top_size: "L",
    bottom_size: "32",
    shoe_size_mm: "270",
    fit_preference: "너무 붙지 않게"
  },
  feedback: {
    diagnosis: "전체적으로 편안하지만 상의와 신발의 선을 정리하면 더 단정해집니다.",
    improvements: [
      "상의 길이를 골반선 근처로 맞추세요.",
      "검정 슬랙스 주름을 줄이면 깔끔해 보입니다.",
      "흰색 스니커즈는 깨끗한 상태일 때 가장 좋습니다."
    ],
    recommended_outfit: seededOutfit,
    today_action: "셔츠를 넣어 입은 버전과 빼서 입은 버전을 거울 앞에서 비교하세요.",
    day1_mission: "옷장에서 단정한 상의 하나를 골라 오늘 조합의 기준으로 삼으세요."
  },
  recommendation_feedback: {
    reaction: "helpful",
    note: "단정한 방향이 좋았음",
    outfit_title: seededOutfit.title,
    created_at: "2026-04-15T09:00:00.000Z"
  },
  feedback_history: [
    {
      day: 1,
      summary: "편안한 기본 조합에서 상의 길이와 신발 상태를 먼저 정리했습니다.",
      action: "셔츠 넣어 입기 비교"
    },
    {
      day: 2,
      summary: "검정 슬랙스 중심으로 단정한 출근 조합을 확인했습니다.",
      action: "슬랙스 주름 정리"
    },
    {
      day: 3,
      summary: "네이비 셔츠와 흰색 스니커즈의 색 균형을 확인했습니다.",
      action: "신발 오염 체크"
    }
  ]
};

async function isServerReady() {
  try {
    const response = await fetch(baseUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 120000) {
    if (await isServerReady()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`server_not_ready:${baseUrl}`);
}

async function ensureServer() {
  if (await isServerReady()) {
    return null;
  }

  const child = spawn("npm", ["run", "dev"], {
    env: {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ""}`,
      AUTH_JWT_SECRET: jwtSecret,
      AI_PROVIDER: "mock",
      TRY_ON_PROVIDER: "mock",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_STORAGE_BUCKET: ""
    },
    stdio: "ignore"
  });

  await waitForServer();
  return child;
}

async function issueAccessToken() {
  return new SignJWT({
    type: "access",
    email: "visual-smoke@example.com",
    name: "Visual Smoke User",
    picture: null,
    provider: "google"
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("visual-smoke-user")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(jwtSecret));
}

async function addSessionCookie(context) {
  const token = await issueAccessToken();
  const url = new URL(baseUrl);

  await context.addCookies([
    {
      name: "reman_access_token",
      value: token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

async function seedPage(page) {
  await page.addInitScript((state) => {
    window.localStorage.setItem("reman:onboarding", JSON.stringify(state));
  }, seededState);
}

async function capturePage(browser, scenario, pageSpec) {
  const context = await browser.newContext({ viewport: scenario.viewport });
  await addSessionCookie(context);
  const page = await context.newPage();
  await seedPage(page);

  const artifact = `${outputDir}/${scenario.id}-${pageSpec.id}.png`;

  try {
    await page.goto(`${baseUrl}${pageSpec.path}`);
    await expect(page.getByText(pageSpec.visibleText).first()).toBeVisible();
    if (pageSpec.expandFirstHistoryCard) {
      await page.locator(".history-card-trigger").first().click();
      await page
        .getByText("추천 근거")
        .first()
        .evaluate((element) => element.scrollIntoView({ block: "center" }));
    }
    for (const text of [pageSpec.expectedText, ...(pageSpec.expectedTexts ?? [])].filter(Boolean)) {
      await expect(page.getByText(text).first()).toBeVisible();
    }
    for (const text of [pageSpec.hiddenText, ...(pageSpec.hiddenTexts ?? [])].filter(Boolean)) {
      await expect(page.getByText(text).first()).toHaveCount(0);
    }
    await expect(page.getByText("계정 기록 로드 실패").first()).toHaveCount(0);
    await expect(page.getByText(/^provider:/).first()).toHaveCount(0);
    await page.screenshot({ fullPage: true, path: artifact });

    return {
      id: pageSpec.id,
      path: pageSpec.path,
      artifact
    };
  } finally {
    await context.close();
  }
}

async function captureScenario(browser, scenario) {
  const artifacts = [];

  for (const pageSpec of pages) {
    artifacts.push(await capturePage(browser, scenario, pageSpec));
  }

  return {
    ...scenario,
    artifacts
  };
}

async function capture() {
  await mkdir(outputDir, { recursive: true });

  const server = await ensureServer();
  const browser = await chromium.launch();

  try {
    const results = [];

    for (const scenario of scenarios) {
      results.push(await captureScenario(browser, scenario));
    }

    const report = {
      generated_at: new Date().toISOString(),
      base_url: baseUrl,
      scenarios: results,
      artifacts: results.flatMap((result) =>
        result.artifacts.map((artifact) => artifact.artifact)
      ),
      verified: [
        "home, style, upload, result, closet, history, history detail, profile, settings pages render in a real browser",
        "mobile and desktop screenshots are captured for UI review",
        "seeded auth cookie allows protected pages to render",
        "history load failure banner is not visible",
        "developer provider labels are not visible"
      ]
    };

    await writeFile(`${outputDir}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
    console.log(report.artifacts.join("\n"));
  } finally {
    await browser.close();
    server?.kill();
  }
}

capture().catch((error) => {
  console.error(error);
  process.exit(1);
});
