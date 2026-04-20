#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { SignJWT } from "jose";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { deflateSync } from "node:zlib";

const baseUrl = process.env.SMOKE_BASE_URL;
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? "120000");
const jwtSecret = process.env.AUTH_JWT_SECRET ?? "";
const smokeUserId =
  process.env.SMOKE_USER_ID ?? `production-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const smokeEmail = process.env.SMOKE_USER_EMAIL ?? `${smokeUserId}@example.com`;
const imagePath =
  process.env.SMOKE_IMAGE_PATH ??
  path.resolve("output/playwright/production-smoke-style-photo.png");

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

function pngChunk(kind, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(kind), data])));
  return Buffer.concat([length, Buffer.from(kind), data, crc]);
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
    email: smokeEmail,
    name: "Production Smoke User",
    picture: null,
    provider: "google"
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(smokeUserId)
    .setIssuedAt()
    .setExpirationTime("20m")
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
      sameSite: "Lax",
      secure: url.protocol === "https:"
    }
  ]);
}

async function getJson(request, route) {
  const response = await request.get(`${baseUrl}${route}`, { timeout: 30000 });
  const body = await response.json().catch(async () => ({
    raw: await response.text().catch(() => "")
  }));

  if (!response.ok()) {
    throw new Error(
      `${route} failed with ${response.status()}: ${JSON.stringify(body).slice(0, 500)}`
    );
  }

  return body;
}

async function selectClosetOptionalField(page, label, value) {
  await page
    .locator("label")
    .filter({ hasText: new RegExp(`^${label}`) })
    .locator("select")
    .selectOption(value);
}

async function addClosetItem(page, item) {
  await page.getByRole("button", { name: "옷 추가", exact: true }).click();

  const directAdd = page.getByRole("button", { name: /한 벌 직접 등록/ });

  if (await directAdd.isVisible({ timeout: 1000 }).catch(() => false)) {
    await directAdd.click();
  }

  await page.locator("#closet-photo-upload").setInputFiles(imagePath);
  await page.getByLabel("종류").selectOption(item.category);
  await page.getByRole("button", { name: /선택 정보 열기/ }).click();
  await page.getByLabel("아이템 이름").fill(item.name);

  if (item.color) {
    await page.getByLabel("색").fill(item.color);
  }

  if (item.fit) {
    await page.getByLabel("핏").fill(item.fit);
  }

  if (item.size) {
    await page.getByLabel("사이즈").fill(item.size);
  }

  if (item.wearState) {
    await page.getByLabel("착용감").selectOption(item.wearState);
  }

  if (item.wearFrequency) {
    await page.getByLabel("빈도").selectOption(item.wearFrequency);
  }

  if (item.season) {
    await page.getByLabel("계절").selectOption(item.season);
  }

  if (item.condition) {
    await selectClosetOptionalField(page, "상태", item.condition);
  }

  await page.getByRole("button", { name: /사진을 옷장에 추가/ }).click();
}

function assertCreditDebit({ before, after, feedback }) {
  if (feedback.credits_charged !== 1) {
    throw new Error(`expected credits_charged=1, received ${feedback.credits_charged}`);
  }

  if (after.balance !== before.balance - 1) {
    throw new Error(
      `expected credit balance ${before.balance - 1}, received ${after.balance}`
    );
  }

  if (!after.ledger_ok) {
    throw new Error("credit ledger audit failed after feedback");
  }
}

async function main() {
  if (!baseUrl) {
    console.error("SMOKE_BASE_URL is required. Example: SMOKE_BASE_URL=https://<deployment> npm run smoke:production:mvp");
    return 1;
  }

  if (!jwtSecret) {
    console.error("AUTH_JWT_SECRET is required to issue a smoke session cookie.");
    return 1;
  }

  ensureSmokeImage();

  const browser = await chromium.launch();
  const context = await browser.newContext();
  await addSessionCookie(context);
  const page = await context.newPage();
  const started = Date.now();

  try {
    const creditBefore = await getJson(context.request, "/api/credits");

    if (!creditBefore.ledger_ok || creditBefore.balance < 1) {
      throw new Error(`credit precheck failed: ${JSON.stringify(creditBefore)}`);
    }

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

    const feedbackResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/feedback") &&
        response.request().method() === "POST",
      { timeout: timeoutMs }
    );
    await page.getByRole("button", { name: "AI 분석 시작하기" }).click();

    const response = await feedbackResponse;
    const feedback = await response.json().catch(async () => ({
      raw: await response.text().catch(() => "")
    }));

    if (!response.ok()) {
      throw new Error(`/api/feedback failed with ${response.status()}: ${JSON.stringify(feedback)}`);
    }

    await page.waitForURL(/\/programs\/style\/onboarding\/result$/, {
      timeout: 10000
    });
    await page.getByRole("button", { name: "도움됨" }).click();
    await page.getByLabel("짧은 메모").fill("배포 smoke 확인");
    await page.getByRole("button", { name: "추천 반응 저장" }).click();
    await page.getByRole("button", { name: /도움됨 저장됨/ }).waitFor({ timeout: 10000 });

    const creditAfter = await getJson(context.request, "/api/credits");
    assertCreditDebit({ before: creditBefore, after: creditAfter, feedback });

    const transactions = await getJson(context.request, "/api/credits/transactions?limit=5");
    const styleDebit = transactions.transactions?.find(
      (transaction) => transaction.type === "debit" && transaction.reason === "style_feedback"
    );

    if (!styleDebit) {
      throw new Error("style_feedback debit transaction was not found");
    }

    await page.getByRole("link", { name: "기록에서 보기" }).click();
    await page.waitForURL(/\/history$/, { timeout: 10000 });
    await page.getByRole("heading", { name: "기록" }).waitFor({ timeout: 10000 });

    console.log(
      JSON.stringify(
        {
          ok: true,
          user_id: smokeUserId,
          duration_ms: Date.now() - started,
          result_url: page.url(),
          recommended_outfit: feedback.recommended_outfit?.title ?? null,
          credits_before: creditBefore.balance,
          credits_after: creditAfter.balance,
          credit_reference_id: feedback.credit_reference_id ?? null,
          debit_transaction_id: styleDebit.id ?? null
        },
        null,
        2
      )
    );
    return 0;
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          user_id: smokeUserId,
          duration_ms: Date.now() - started,
          error: error instanceof Error ? error.message : String(error)
        },
        null,
        2
      )
    );
    return 1;
  } finally {
    await browser.close();
  }
}

main().then((code) => process.exit(code));
