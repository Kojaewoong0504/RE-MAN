import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
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
  it("fails readiness when package.json contains a platform-locked direct dependency", () => {
    const packageJsonPath = "package.json";
    const original = fs.readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(original);

    parsed.devDependencies = {
      ...parsed.devDependencies,
      "@rolldown/binding-wasm32-wasi": "^1.0.0-rc.13"
    };

    fs.writeFileSync(packageJsonPath, `${JSON.stringify(parsed, null, 2)}\n`);

    try {
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
      expect(result.stdout).toContain("FAIL install-platform-compatibility");
      expect(result.stdout).toContain("@rolldown/binding-wasm32-wasi");
    } finally {
      fs.writeFileSync(packageJsonPath, original);
    }
  });

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
    expect(deploymentReadiness).toContain("platform package");
    expect(deploymentReadiness).toContain("`npm install`");
    expect(packageJson.scripts["check:deploy:vercel"]).toContain("--runtime-from-vercel-project");
    expect(deploymentReadiness).toContain("runtime(`/api/try-on`)");
    expect(deploymentReadiness).toContain("env pull");
    expect(deploymentReadiness).toContain("--value vertex");
    expect(fs.existsSync("scripts/perf-app-shell.mjs")).toBe(true);
    expect(fs.existsSync("scripts/smoke-production-mvp.mjs")).toBe(true);
    expect(matrix).toContain("`npm run smoke:production:mvp`");
    expect(matrix).toContain("배포 MVP golden path 통과");
    expect(matrix).toContain("`npm run perf:app-shell`");
    expect(matrix).toContain("install compatibility");
    expect(deploymentReadiness).toContain("canonical production host");
  });

  it("allows try-on readiness when vertex uses Firebase service account auth", () => {
    const result = spawnSync(
      "node",
      ["scripts/check-deploy-readiness.mjs", "--strict"],
      {
        cwd: process.cwd(),
        env: {
          ...strictRealAiEnv,
          CREDIT_LEDGER_PROVIDER: "firestore",
          TRY_ON_PROVIDER: "vertex",
          VERTEX_PROJECT_ID: "fitreco-vto",
          VERTEX_LOCATION: "us-central1",
          VERTEX_ACCESS_TOKEN: ""
        },
        encoding: "utf-8"
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS try-on-real-provider");
  });

  it("fails runtime verification when deployed try-on provider falls back to mock", async () => {
    const server = http.createServer((request, response) => {
      if (request.url === "/api/try-on") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            provider: "mock",
            real_generation_enabled: false,
            model_id: "virtual-try-on-001",
            missing_config: [],
            auth_source: "service_account"
          })
        );
        return;
      }

      response.writeHead(404);
      response.end("not found");
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("server did not start");
    }

    try {
      const result = await new Promise<{
        status: number | null;
        stdout: string;
        stderr: string;
      }>((resolve) => {
        const child = spawn(
          "node",
          [
            "scripts/check-deploy-readiness.mjs",
            "--strict",
            `--runtime-url=http://127.0.0.1:${address.port}`
          ],
          {
            cwd: process.cwd(),
            env: {
              ...strictRealAiEnv,
              CREDIT_LEDGER_PROVIDER: "firestore",
              TRY_ON_PROVIDER: "vertex",
              VERTEX_PROJECT_ID: "fitreco-vto",
              VERTEX_LOCATION: "us-central1"
            },
            stdio: ["ignore", "pipe", "pipe"]
          }
        );

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });

        child.on("close", (status) => {
          resolve({ status, stdout, stderr });
        });
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("FAIL try-on-runtime-provider");
      expect(result.stdout).toContain("runtime provider=mock");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});
