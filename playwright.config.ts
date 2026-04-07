import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev",
    env: {
      AI_PROVIDER: "mock",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_STORAGE_BUCKET: ""
    },
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    timeout: 120000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"]
      }
    }
  ]
});
