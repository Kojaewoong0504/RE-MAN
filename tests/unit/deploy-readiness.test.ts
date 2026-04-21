import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const strictRealAiEnv = {
  ...process.env,
  AI_PROVIDER: "gemini",
  CLOSET_ANALYSIS_PROVIDER: "gemini",
  CREDIT_LEDGER_PROVIDER: "memory",
  TRY_ON_PROVIDER: "mock",
  GOOGLE_API_KEY: "test-google-key",
  AUTH_JWT_SECRET: "test-auth-secret",
  FIREBASE_ADMIN_PROJECT_ID: "test-project",
  FIREBASE_CLIENT_EMAIL: "firebase-admin@test-project.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----\\n",
  NEXT_PUBLIC_FIREBASE_API_KEY: "test-firebase-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
  NEXT_PUBLIC_FIREBASE_APP_ID: "test-app-id",
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.com",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-supabase-anon",
  SUPABASE_SERVICE_ROLE_KEY: "test-supabase-service",
  SUPABASE_STORAGE_BUCKET: "test-bucket"
};

describe("deployment readiness", () => {
  it("fails strict readiness when the credit ledger is still memory backed", () => {
    const result = spawnSync(
      "node",
      ["scripts/check-deploy-readiness.mjs", "--strict"],
      {
        cwd: process.cwd(),
        env: strictRealAiEnv,
        encoding: "utf-8"
      }
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("FAIL credit-ledger-persistence");
    expect(result.stdout).toContain("memory");
  });

  it("allows strict readiness when the credit ledger provider is Firestore", () => {
    const result = spawnSync(
      "node",
      ["scripts/check-deploy-readiness.mjs", "--strict"],
      {
        cwd: process.cwd(),
        env: {
          ...strictRealAiEnv,
          CREDIT_LEDGER_PROVIDER: "firestore"
        },
        encoding: "utf-8"
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS credit-ledger-persistence");
    expect(result.stdout).toContain("Firestore");
  });

  it("documents a production MVP golden path smoke command", () => {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const matrix = fs.readFileSync("docs/engineering/verification-matrix.md", "utf8");
    const deploymentReadiness = fs.readFileSync("docs/engineering/deployment-readiness.md", "utf8");

    expect(packageJson.scripts["smoke:production:mvp"]).toBe(
      "node scripts/smoke-production-mvp.mjs"
    );
    expect(packageJson.scripts["perf:app-shell"]).toBe("node scripts/perf-app-shell.mjs");
    expect(fs.existsSync("scripts/perf-app-shell.mjs")).toBe(true);
    expect(fs.existsSync("scripts/smoke-production-mvp.mjs")).toBe(true);
    expect(matrix).toContain("`npm run smoke:production:mvp`");
    expect(matrix).toContain("배포 MVP golden path 통과");
    expect(matrix).toContain("`npm run perf:app-shell`");
    expect(deploymentReadiness).toContain("canonical production host");
  });
});
