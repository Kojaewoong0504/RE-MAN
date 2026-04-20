#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict") || process.env.DEPLOYMENT_STRICT_REAL_AI === "true";

function getArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
    return null;
  }

  const index = trimmed.indexOf("=");
  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();

  if (!key) {
    return null;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  } else {
    value = value.split("#")[0]?.trim() ?? "";
  }

  return [key, value];
}

function loadEnvFile(env, relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);

  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseEnvLine(line);

    if (!parsed) {
      continue;
    }

    const [key, value] = parsed;

    if (env[key] === undefined) {
      env[key] = value;
    }
  }
}

function loadEnv() {
  const env = { ...process.env };
  const explicitEnvFile = getArgValue("--env-file");

  for (const envFile of [".env.vercel.local", ".env.local", ".env", explicitEnvFile].filter(Boolean)) {
    loadEnvFile(env, envFile);
  }

  return env;
}

function present(env, key) {
  return typeof env[key] === "string" && env[key].trim().length > 0;
}

function missing(env, keys) {
  return keys.filter((key) => !present(env, key));
}

function statusLine(status, id, message) {
  return { status, id, message };
}

function providerValue(env, key) {
  return present(env, key) ? env[key].trim() : "mock";
}

function failWhenStrict(id, warningMessage, strictMessage = warningMessage) {
  return strict ? statusLine("FAIL", id, strictMessage) : statusLine("WARN", id, warningMessage);
}

function checkStyleFeedback(env) {
  const provider = providerValue(env, "AI_PROVIDER");

  if (provider === "mock") {
    return failWhenStrict(
      "style-feedback-real-ai",
      "AI_PROVIDER=mock 상태입니다. 배포 UI는 동작해도 실제 Gemini 분석은 아닙니다.",
      "AI_PROVIDER=mock 상태라 배포에서 실제 스타일 분석으로 보고할 수 없습니다."
    );
  }

  if (provider !== "gemini") {
    return statusLine("FAIL", "style-feedback-real-ai", `지원하지 않는 AI_PROVIDER=${provider}`);
  }

  const required = [
    "GOOGLE_API_KEY",
    "AUTH_JWT_SECRET",
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET"
  ];
  const missingKeys = missing(env, required);

  if (missingKeys.length > 0) {
    return statusLine(
      "FAIL",
      "style-feedback-real-ai",
      `AI_PROVIDER=gemini 이지만 필수 env가 없습니다: ${missingKeys.join(", ")}`
    );
  }

  return statusLine(
    "PASS",
    "style-feedback-real-ai",
    "스타일 분석은 실제 Gemini provider와 크레딧 경로를 사용할 수 있는 env 형태입니다."
  );
}

function checkClosetBatch(env) {
  const provider = providerValue(env, "CLOSET_ANALYSIS_PROVIDER");

  if (provider === "mock") {
    return failWhenStrict(
      "closet-batch-real-ai",
      "옷장 대량 등록은 mock 초안입니다. 실제 옷 인식으로 보고할 수 없습니다.",
      "CLOSET_ANALYSIS_PROVIDER=mock 상태라 배포에서 실제 옷 인식으로 보고할 수 없습니다."
    );
  }

  if (provider !== "gemini") {
    return statusLine(
      "FAIL",
      "closet-batch-real-ai",
      `지원하지 않는 CLOSET_ANALYSIS_PROVIDER=${provider}`
    );
  }

  const required = ["GOOGLE_API_KEY", "AUTH_JWT_SECRET"];
  const missingKeys = missing(env, required);

  if (missingKeys.length > 0) {
    return statusLine(
      "FAIL",
      "closet-batch-real-ai",
      `CLOSET_ANALYSIS_PROVIDER=gemini 이지만 필수 env가 없습니다: ${missingKeys.join(", ")}`
    );
  }

  return statusLine(
    "PASS",
    "closet-batch-real-ai",
    "옷장 대량 등록은 실제 Gemini provider와 크레딧 경로를 사용할 수 있는 env 형태입니다."
  );
}

function checkCreditLedger(env) {
  const required = [
    "AUTH_JWT_SECRET",
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY"
  ];
  const missingKeys = missing(env, required);

  if (missingKeys.length > 0) {
    return statusLine(
      "FAIL",
      "credit-ledger-auth",
      `크레딧 원장/권한 검증에 필요한 env가 없습니다: ${missingKeys.join(", ")}`
    );
  }

  return statusLine(
    "PASS",
    "credit-ledger-auth",
    "크레딧 원장 API가 인증된 사용자 기준으로 동작할 수 있는 env 형태입니다."
  );
}

function checkTryOn(env) {
  const provider = providerValue(env, "TRY_ON_PROVIDER");

  if (provider === "mock") {
    return statusLine(
      "WARN",
      "try-on-real-provider",
      "TRY_ON_PROVIDER=mock 상태입니다. 실제 실착 이미지 생성으로 보고할 수 없습니다."
    );
  }

  if (provider !== "vertex") {
    return statusLine("FAIL", "try-on-real-provider", `지원하지 않는 TRY_ON_PROVIDER=${provider}`);
  }

  const required = [
    "VERTEX_PROJECT_ID",
    "VERTEX_LOCATION",
    "VERTEX_ACCESS_TOKEN"
  ];
  const missingKeys = missing(env, required);

  if (missingKeys.length > 0) {
    return statusLine(
      "FAIL",
      "try-on-real-provider",
      `TRY_ON_PROVIDER=vertex 이지만 필수 env가 없습니다: ${missingKeys.join(", ")}`
    );
  }

  return statusLine("PASS", "try-on-real-provider", "실착 provider env 형태가 준비되어 있습니다.");
}

const env = loadEnv();
const results = [
  checkStyleFeedback(env),
  checkClosetBatch(env),
  checkCreditLedger(env),
  checkTryOn(env)
];

for (const result of results) {
  console.log(`${result.status} ${result.id}: ${result.message}`);
}

const failed = results.filter((result) => result.status === "FAIL");
const warned = results.filter((result) => result.status === "WARN");

console.log(
  `\nDeployment readiness: ${failed.length} fail(s), ${warned.length} warning(s), strict=${strict}`
);

if (failed.length > 0) {
  process.exit(1);
}
