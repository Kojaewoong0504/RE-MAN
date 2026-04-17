import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("MVP harness", () => {
  it("guards closet basis UI labels against internal status regressions", () => {
    const result = spawnSync("python3", ["harness/mvp/run.py"], {
      cwd: process.cwd(),
      encoding: "utf-8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS basis-ui-labels");
  });
});
