#!/usr/bin/env node

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3001";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? "90000");
const imagePath =
  process.env.SMOKE_IMAGE_PATH ??
  path.resolve("output/playwright/browser-smoke-style-photo.png");

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

async function main() {
  ensureSmokeImage();

  const browser = await chromium.launch();
  const page = await browser.newPage();
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
    await page.getByLabel("자주 입는 상의").fill("무지 티셔츠, 후드티");
    await page.getByLabel("자주 입는 하의").fill("청바지, 검정 슬랙스");
    await page.getByLabel("자주 신는 신발").fill("흰색 스니커즈");
    await page.getByRole("button", { name: /전체적인 스타일 리셋/ }).click();
    await page.getByRole("button", { name: "배우는 중" }).click();

    const feedbackResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/feedback") &&
        response.request().method() === "POST",
      { timeout: timeoutMs }
    );
    await page.getByRole("button", { name: "AI 분석 시작하기" }).click();

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

    console.log(
      JSON.stringify(
        {
          ok: true,
          status: response.status(),
          duration_ms: durationMs,
          result_url: page.url(),
          recommended_outfit: data.recommended_outfit?.title ?? null
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
