#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.VISUAL_SMOKE_BASE_URL ?? "http://127.0.0.1:3001";
const outputDir = "output/playwright/result-minimal";
const scenarios = [
  {
    id: "desktop",
    label: "desktop",
    viewport: { width: 768, height: 1024 }
  },
  {
    id: "mobile",
    label: "mobile",
    viewport: { width: 390, height: 844 }
  }
];
const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s3FoX0AAAAASUVORK5CYII=";

const recommendedOutfit = {
  title: "지금 가진 옷으로 만드는 깔끔한 기본 조합",
  items: ["네이비 셔츠", "검정 슬랙스", "검정 로퍼"],
  reason: "지금 가진 옷 안에서 가장 단정하게 보이는 조합입니다.",
  try_on_prompt: "전신 정면 사진 기준 네이비 셔츠, 검정 슬랙스, 검정 로퍼 실착 미리보기"
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

async function seedResultState(page) {
  await page.addInitScript(
    ({ outfit, image }) => {
      window.localStorage.setItem(
        "reman:onboarding",
        JSON.stringify({
          survey: {
            current_style: "청바지 + 무지 티셔츠",
            motivation: "직장 이미지 변화",
            budget: "15~30만원",
            style_goal: "면접 전 단정한 인상",
            confidence_level: "배우는 중"
          },
          closet_profile: {
            tops: "네이비 셔츠",
            bottoms: "검정 슬랙스",
            shoes: "검정 로퍼",
            outerwear: "차콜 자켓"
          },
          image,
          feedback: {
            diagnosis: "현재 조합은 편안하지만, 면접 전 인상 기준으로는 상의와 신발의 단정함을 더 또렷하게 잡는 편이 좋습니다.",
            improvements: [
              "상의 길이를 골반선 근처로 정리하면 비율이 좋아 보여요.",
              "검정 슬랙스 주름을 줄이면 훨씬 단정해 보입니다.",
              "신발은 로퍼처럼 매끈한 형태가 전체 인상을 정리해 줍니다."
            ],
            recommended_outfit: outfit,
            today_action: "오늘은 셔츠를 넣어 입은 버전과 빼서 입은 버전을 사진으로 비교해보세요.",
            day1_mission: "옷장에서 면접에 입을 수 있는 상의 두 개만 꺼내 비교하세요."
          },
          feedback_history: [
            {
              day: 1,
              summary: "면접 전 단정한 인상 기준으로 기본 조합을 정리했습니다.",
              action: "셔츠 넣어 입기와 빼서 입기 비교"
            }
          ]
        })
      );
    },
    { outfit: recommendedOutfit, image: tinyPng }
  );
}

async function setupDeterministicRoutes(page) {
  await seedResultState(page);
}

async function captureScenario(browser, scenario) {
  const page = await browser.newPage({ viewport: scenario.viewport });
  const artifacts = [
    `${outputDir}/${scenario.id}-01-result.png`,
    `${outputDir}/${scenario.id}-02-improvements-open.png`
  ];

  await setupDeterministicRoutes(page);

  try {
    await page.goto(`${baseUrl}/programs/style/onboarding/result`);
    await expect(page.getByRole("heading", { name: "오늘 바꿀 조합만 먼저 봅니다" })).toBeVisible();
    await expect(page.getByText(/^provider:/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /핏 더 보기/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /레퍼런스\/실착 보기/ })).toHaveCount(0);
    await page.screenshot({ fullPage: true, path: artifacts[0] });

    await page.getByRole("button", { name: /바꿀 점 3개 보기/ }).click();
    await expect(page.getByText("검정 슬랙스 주름을 줄이면 훨씬 단정해 보입니다.")).toBeVisible();
    await page.screenshot({ fullPage: true, path: artifacts[1] });

    return {
      ...scenario,
      artifacts,
      verified: [
        `${scenario.label}: result page renders seeded feedback`,
        `${scenario.label}: improvements expand without server traffic controls`,
        `${scenario.label}: deep-dive and try-on entry points are hidden`,
        `${scenario.label}: developer provider label is hidden`
      ]
    };
  } finally {
    await page.close();
  }
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
      scenarios: results.map(({ id, label, viewport, artifacts, verified }) => ({
        id,
        label,
        viewport,
        artifacts,
        verified
      })),
      artifacts: results.flatMap((result) => result.artifacts),
      verified: results.flatMap((result) => result.verified)
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
