#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { SignJWT } from "jose";
import fs from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3001";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? "90000");
const imagePath =
  process.env.SMOKE_IMAGE_PATH ??
  path.resolve("output/playwright/browser-smoke-style-photo.png");

function loadEnvValue(name, fallback = "") {
  if (process.env[name]) {
    return process.env[name];
  }

  for (const envFile of [".env.vercel.local", ".env.local"]) {
    const envPath = path.resolve(envFile);

    if (!fs.existsSync(envPath)) {
      continue;
    }

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...rest] = trimmed.split("=");
      if (key.trim() !== name) {
        continue;
      }

      let value = rest.join("=").trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      return value;
    }
  }

  return fallback;
}

const jwtSecret = loadEnvValue(
  "AUTH_JWT_SECRET",
  "development-auth-secret-change-me"
);

function pngChunk(kind, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(kind), data])));
  return Buffer.concat([length, Buffer.from(kind), data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function ensureSmokeImage() {
  if (fs.existsSync(imagePath)) {
    return;
  }

  fs.mkdirSync(path.dirname(imagePath), { recursive: true });

  const width = 720;
  const height = 1080;
  const rows = [];

  for (let y = 0; y < height; y += 1) {
    const row = [0];

    for (let x = 0; x < width; x += 1) {
      let color = [244, 236, 221];
      const centerX = width / 2;

      if ((x - centerX) ** 2 + (y - 210) ** 2 < 65 ** 2) {
        color = [70, 55, 45];
      } else if (Math.abs(x - centerX) < 95 && y > 300 && y < 620) {
        color = [45, 75, 120];
      } else if (Math.abs(x - centerX) < 120 && y >= 620 && y < 900) {
        color = [35, 45, 65];
      } else if (
        ((x > centerX - 95 && x < centerX - 25) ||
          (x > centerX + 25 && x < centerX + 95)) &&
        y >= 900 &&
        y < 1030
      ) {
        color = [35, 35, 35];
      }

      row.push(...color);
    }

    rows.push(Buffer.from(row));
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;

  const png = Buffer.concat([
    Buffer.from("\x89PNG\r\n\x1a\n", "binary"),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows), { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);

  fs.writeFileSync(imagePath, png);
}

async function issueAccessToken() {
  return new SignJWT({
    type: "access",
    email: "browser-smoke@example.com",
    name: "Browser Smoke User",
    picture: null,
    provider: "google"
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("browser-smoke-user")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(jwtSecret));
}

async function addSessionCookie(context) {
  const url = new URL(baseUrl);
  const token = await issueAccessToken();

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

async function addClosetItem(page, item) {
  const openClosetButton = page.getByRole("button", { name: "옷장 추가" });
  if (await openClosetButton.isVisible().catch(() => false)) {
    await openClosetButton.click();
  }

  await page.getByRole("button", { name: "옷 추가", exact: true }).click();
  await page.getByRole("button", { name: "한 벌 직접 등록" }).click();
  const dialog = page.getByRole("dialog", { name: "옷 추가" });
  await dialog.locator("#closet-photo-upload").setInputFiles(imagePath);
  await dialog.getByLabel("종류").selectOption(item.category);
  await dialog.getByRole("button", { name: "선택 정보 펼치기" }).click();
  await dialog.getByLabel("아이템 이름").fill(item.name);

  if (item.color) {
    await dialog.getByLabel("색").fill(item.color);
  }

  if (item.fit) {
    await dialog.getByLabel("핏").fill(item.fit);
  }

  if (item.size) {
    await dialog.getByLabel("사이즈").fill(item.size);
  }

  if (item.wearState) {
    await dialog.getByLabel("착용감").selectOption(item.wearState);
  }

  if (item.wearFrequency) {
    await dialog.getByLabel("빈도").selectOption(item.wearFrequency);
  }

  if (item.season) {
    await dialog.getByLabel("계절").selectOption(item.season);
  }

  if (item.condition) {
    await dialog.getByLabel("상태").selectOption(item.condition);
  }

  await dialog.getByRole("button", { name: /사진을 옷장에 추가/ }).click();
  await dialog.waitFor({ state: "hidden", timeout: 10000 });
  await page.getByText(item.name, { exact: false }).first().waitFor({ timeout: 10000 });
}

async function main() {
  ensureSmokeImage();

  const browser = await chromium.launch();
  const context = await browser.newContext();
  await addSessionCookie(context);
  const page = await context.newPage();
  const started = Date.now();

  try {
    await page.goto(`${baseUrl}/programs/style/onboarding/survey`, {
      waitUntil: "networkidle",
      timeout: 30000
    });
    await page.getByRole("button", { name: /청바지 \+ 무지 티셔츠/ }).click();
    await page.getByRole("button", { name: /소개팅 \/ 이성 만남/ }).click();
    await page.getByRole("button", { name: /15~30만원/ }).click();
    await page.getByRole("button", { name: "사진 업로드로 이동" }).click();

    await page.locator("#photo-upload").setInputFiles(imagePath);
    await addClosetItem(page, {
      category: "tops",
      name: "무지 티셔츠",
      color: "흰색",
      fit: "레귤러",
      size: "L",
      wearState: "잘 맞음",
      wearFrequency: "자주 입음",
      season: "사계절",
      condition: "깨끗함"
    });
    await addClosetItem(page, {
      category: "bottoms",
      name: "검정 슬랙스",
      color: "검정",
      size: "32",
      wearState: "잘 맞음"
    });
    await addClosetItem(page, {
      category: "shoes",
      name: "스니커즈",
      color: "흰색",
      size: "270"
    });

    const analyzeButton = page.getByRole("button", { name: "AI 분석 시작하기" });
    await analyzeButton.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(() => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (element) => element.textContent?.trim() === "AI 분석 시작하기"
      );
      return Boolean(button && !button.hasAttribute("disabled"));
    }, { timeout: 10000 });

    const feedbackResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/feedback") &&
        response.request().method() === "POST",
      { timeout: timeoutMs }
    );
    await analyzeButton.click();

    const response = await feedbackResponse;
    const data = await response.json().catch(async () => ({
      raw: await response.text().catch(() => "")
    }));
    const durationMs = Date.now() - started;

    if (!response.ok()) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            status: response.status(),
            duration_ms: durationMs,
            error: data
          },
          null,
          2
        )
      );
      return 1;
    }

    await page.waitForURL(/\/programs\/style\/onboarding\/result$/, {
      timeout: 10000
    });

    const bodyProfile = data?.body_profile;
    const safetyBasis = data?.recommended_outfit?.safety_basis;
    const avoidNotes = data?.recommended_outfit?.avoid_notes;
    const hasAnyBodySignal =
      bodyProfile &&
      typeof bodyProfile === "object" &&
      [
        "upper_body_presence",
        "lower_body_balance",
        "belly_visibility",
        "leg_length_impression",
        "shoulder_shape",
        "neck_impression",
        "overall_frame"
      ].some((field) => typeof bodyProfile[field] === "string" && bodyProfile[field].trim());

    if (!hasAnyBodySignal) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            status: response.status(),
            duration_ms: durationMs,
            error: "body_profile missing from browser Gemini flow",
            body_profile: bodyProfile
          },
          null,
          2
        )
      );
      return 1;
    }

    if (
      !Array.isArray(safetyBasis) ||
      safetyBasis.length !== 3 ||
      !safetyBasis.every((item) => typeof item === "string" && item.trim())
    ) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            status: response.status(),
            duration_ms: durationMs,
            error: "recommended_outfit.safety_basis missing or malformed",
            safety_basis: safetyBasis
          },
          null,
          2
        )
      );
      return 1;
    }

    if (
      !Array.isArray(avoidNotes) ||
      avoidNotes.length !== 3 ||
      !avoidNotes.every((item) => typeof item === "string" && item.trim())
    ) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            status: response.status(),
            duration_ms: durationMs,
            error: "recommended_outfit.avoid_notes missing or malformed",
            avoid_notes: avoidNotes
          },
          null,
          2
        )
      );
      return 1;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          status: response.status(),
          duration_ms: durationMs,
          result_url: page.url(),
          body_profile: bodyProfile,
          recommended_outfit: data.recommended_outfit?.title ?? null,
          safety_basis: safetyBasis,
          avoid_notes: avoidNotes
        },
        null,
        2
      )
    );
    return 0;
  } finally {
    await browser.close();
  }
}

main().then((code) => process.exit(code));
