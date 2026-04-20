#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";

const candidates = [
  ["npx", ["--yes", "vercel@latest"]],
  ["/opt/homebrew/bin/npx", ["--yes", "vercel@latest"]],
  ["npm", ["exec", "--yes", "--package=vercel@latest", "--", "vercel"]],
  ["/opt/homebrew/bin/npm", ["exec", "--yes", "--package=vercel@latest", "--", "vercel"]]
];

const vercelArgs = [
  "env",
  "pull",
  ".env.vercel.local",
  "--environment=production",
  "--yes"
];

for (const [command, prefixArgs] of candidates) {
  if (command.startsWith("/") && !fs.existsSync(command)) {
    continue;
  }

  const result = spawnSync(command, [...prefixArgs, ...vercelArgs], {
    cwd: process.cwd(),
    stdio: "inherit"
  });

  if (result.error && result.error.code === "ENOENT") {
    continue;
  }

  process.exit(result.status ?? 1);
}

console.error("No Vercel CLI runner found. Install Vercel CLI or ensure npx/npm is in PATH.");
process.exit(1);
