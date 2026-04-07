#!/usr/bin/env python3

import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path.cwd()
CODEX_BIN = "/Applications/Codex.app/Contents/Resources/codex"
REPAIR_CONTEXT = ROOT / "harness" / "reports" / "repair-context.json"
REPORT_PATH = ROOT / "harness" / "reports" / "latest-report.json"
OUTPUT_PATH = ROOT / "harness" / "reports" / "codex-repair-last-message.txt"
MAX_ATTEMPTS_DEFAULT = 1


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def build_env():
    env = os.environ.copy()
    env["PATH"] = f"/Applications/Codex.app/Contents/Resources:/opt/homebrew/bin:/usr/local/bin:{env.get('PATH', '')}"
    return env


def build_prompt(payload: dict, mode: str, attempt: int):
    lines = [
        "You are running inside the repository self-repair orchestrator.",
        f"Current gate mode: {mode}",
        f"Current repair attempt: {attempt}",
        "",
        "Rules:",
        "- Read the listed docs first.",
        "- Fix only the reported failures.",
        "- Keep edits minimal and local.",
        "- Do not weaken rules, delete tests, or bypass gates.",
        "- After editing, stop. The outer orchestrator will rerun the gate.",
        "",
        "Docs to consult:",
    ]
    lines.extend(f"- {doc}" for doc in payload["docs_to_consult"])
    lines.append("")
    lines.append("Failures:")
    for failure in payload["failures"]:
        lines.append(f"- check_name: {failure['check_name']}")
        lines.append(f"  failure_type: {failure['failure_type']}")
        lines.append(f"  signature_hash: {failure['signature_hash']}")
        lines.append(f"  normalized_message: {failure['normalized_message']}")
        lines.append(f"  remediation_hint: {failure['remediation_hint']}")
        if failure["file_paths"]:
            lines.append(f"  file_paths: {', '.join(failure['file_paths'])}")
    lines.append("")
    lines.append("Make the smallest valid edit set now.")
    return "\n".join(lines)


def run_codex(prompt: str):
    command = [
        CODEX_BIN,
        "exec",
        "--sandbox",
        "workspace-write",
        "--full-auto",
        "--cd",
        str(ROOT),
        "--output-last-message",
        str(OUTPUT_PATH),
        prompt,
    ]
    result = subprocess.run(
        command,
        cwd=ROOT,
        env=build_env(),
        text=True,
        capture_output=True,
    )
    return result


def rerun_gate(mode: str):
    result = subprocess.run(
        ["python3", "scripts/run-save-gate.py", mode],
        cwd=ROOT,
        env=build_env(),
        text=True,
        capture_output=True,
    )
    return result


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "pre-commit"
    max_attempts = int(sys.argv[2]) if len(sys.argv) > 2 else MAX_ATTEMPTS_DEFAULT

    if not REPAIR_CONTEXT.exists():
        raise SystemExit("repair-context.json not found")

    payload = load_json(REPAIR_CONTEXT)
    if payload["status"] != "failed":
        print("Repair runner: no failures to repair.")
        return 0

    max_attempts = payload.get("retry_budget", max_attempts)
    if max_attempts <= 0:
        subprocess.run(["python3", "scripts/log_incident.py"], cwd=ROOT, env=build_env())
        print("Repair runner: retry budget is 0, incident logged.", file=sys.stderr)
        return 1

    for attempt in range(1, max_attempts + 1):
        prompt = build_prompt(payload, mode, attempt)
        codex_result = run_codex(prompt)
        print(codex_result.stdout, end="")
        if codex_result.returncode != 0:
            print(codex_result.stderr, end="", file=sys.stderr)
            print("Codex repair runner failed before gate rerun.", file=sys.stderr)
            return 1

        gate_result = rerun_gate(mode)
        print(gate_result.stdout, end="")
        if gate_result.returncode == 0:
            print(f"Repair runner succeeded on attempt {attempt}.")
            return 0

        print(gate_result.stderr, end="", file=sys.stderr)
        if REPORT_PATH.exists():
            subprocess.run(["python3", "scripts/parse_failures.py"], cwd=ROOT, env=build_env())
            subprocess.run(["python3", "scripts/retry-agent.py"], cwd=ROOT, env=build_env())
            payload = load_json(REPAIR_CONTEXT)

    subprocess.run(["python3", "scripts/log_incident.py"], cwd=ROOT, env=build_env())
    print("Repair runner exhausted retry budget and logged an incident.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
