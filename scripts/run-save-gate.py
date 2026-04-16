#!/usr/bin/env python3

import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path.cwd()
REPORTS_DIR = ROOT / "harness" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
REPORT_PATH = REPORTS_DIR / "latest-report.json"


def build_env():
    env = os.environ.copy()
    env["PATH"] = f"/opt/homebrew/bin:/usr/local/bin:{env.get('PATH', '')}"
    return env


def command_specs(mode: str):
    checks = [
        ("repository-harness", "python3 harness/repository/run.py"),
        ("application-harness", "python3 harness/application/run.py"),
        ("content-rules", "python3 harness/application/content_rules.py"),
        ("architecture", "python3 harness/architecture/run.py"),
    ]

    if not Path("node_modules").exists():
        checks.append(
            (
                "dependencies",
                "printf 'Node dependencies are missing. Run /opt/homebrew/bin/npm install first.\\n' >&2 && exit 1",
            )
        )
        return checks

    checks.extend(
        [
            ("typecheck", "npm run typecheck --silent"),
            ("lint", "npm run lint --silent"),
            ("unit-tests", "npm run test:unit --silent"),
        ]
    )

    if mode == "pre-push":
        checks.extend(
            [
                ("integration-tests", "npm run test:integration --silent"),
                ("gc", "python3 harness/gc/run.py"),
                ("e2e-onboarding", "npm run test:e2e -- --project=chromium tests/e2e/onboarding.spec.ts"),
                ("visual-deep-dive", "npm run visual:deep-dive --silent"),
                ("build", "npm run build --silent"),
            ]
        )

    return checks


def run_check(name: str, command: str):
    result = subprocess.run(
        command,
        shell=True,
        cwd=ROOT,
        env=build_env(),
        text=True,
        capture_output=True,
    )
    output = (result.stdout + result.stderr).strip()
    return {
        "name": name,
        "ok": result.returncode == 0,
        "command": command,
        "output": output,
    }


def print_summary(check):
    if check["ok"]:
      print(f"PASS {check['name']}")
      return

    print(f"FAIL {check['name']}")
    if check["output"]:
        print(check["output"])


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "pre-commit"
    checks = [run_check(name, command) for name, command in command_specs(mode)]

    report = {
        "mode": mode,
        "ok": all(check["ok"] for check in checks),
        "summary": {
            "passed": sum(1 for check in checks if check["ok"]),
            "failed": sum(1 for check in checks if not check["ok"]),
        },
        "checks": checks,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    for check in checks:
        print_summary(check)

    if report["ok"]:
        print("Save gate passed.")
        return 0

    print(f"Structured report written to {REPORT_PATH}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
