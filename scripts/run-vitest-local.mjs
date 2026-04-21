#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";
import path from "node:path";

const repoRoot = process.cwd();
const packageName = "@rolldown/binding-wasm32-wasi";
const packageVersion = "1.0.0-rc.13";
const packagePath = path.join(repoRoot, "node_modules", ...packageName.split("/"));

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...extraEnv
    },
    stdio: "inherit"
  });

  if (typeof result.status === "number") {
    process.exitCode = result.status;
    return result.status;
  }

  throw result.error ?? new Error(`${command} failed without exit status`);
}

function ensureLocalWasiBinding() {
  const needsLocalWasi =
    process.platform === "darwin" &&
    process.arch === "arm64" &&
    !existsSync(packagePath);

  if (!needsLocalWasi) {
    return;
  }

  const npmExecPath = process.env.npm_execpath;

  if (!npmExecPath) {
    throw new Error("npm_execpath is not set; cannot install local WASI rolldown binding");
  }

  const status = run(
    process.execPath,
    [
      npmExecPath,
      "install",
      "--no-save",
      "--force",
      `${packageName}@${packageVersion}`
    ]
  );

  if (status !== 0) {
    throw new Error("failed to install local WASI rolldown binding");
  }
}

ensureLocalWasiBinding();

const vitestArgs = process.argv.slice(2);
run(process.execPath, ["./node_modules/vitest/vitest.mjs", "run", ...vitestArgs], {
  NAPI_RS_FORCE_WASI: "1"
});
