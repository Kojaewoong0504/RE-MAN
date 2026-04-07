#!/usr/bin/env python3

import hashlib
import json
import re
from pathlib import Path


ROOT = Path.cwd()
REPORT_PATH = ROOT / "harness" / "reports" / "latest-report.json"
NORMALIZED_PATH = ROOT / "harness" / "reports" / "normalized-failures.json"
LEARNED_PATH = ROOT / "harness" / "learned_failures.json"
FILE_RE = re.compile(r"([A-Za-z0-9_./\-\[\]]+\.(?:py|ts|tsx|js|jsx|json|md))")
RETRY_BUDGETS = {
    "content_rule": 1,
    "lint": 1,
    "typecheck": 1,
    "build": 1,
    "gc": 1,
    "architecture": 1,
    "missing_tool": 0,
    "check_failure": 0,
}


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def classify_failure(name: str, output: str):
    if name == "lint":
        return "lint"
    if name == "typecheck":
        return "typecheck"
    if name == "build":
        return "build"
    if name == "gc":
        return "gc"
    if name == "architecture":
        return "architecture"
    if name == "content-rules":
        return "content_rule"
    if "dependencies are missing" in output or "not available in PATH" in output:
        return "missing_tool"
    return "check_failure"


def remediation_hint(name: str, output: str):
    if name == "content-rules":
        return "Remove forbidden phrases and keep onboarding actions free of shopping language before Day 6."
    if name == "gc":
        return "Delete dead code, remove forbidden debug markers, or connect unreferenced files to the app."
    if name == "lint":
        return "Follow the reported ESLint rule and keep the fix local to the failing file."
    if name == "typecheck":
        return "Fix the type error at the reported location without weakening the type contract."
    if name == "build":
        return "Fix the production build error and re-run the same gate before continuing."
    if "dependencies are missing" in output:
        return "Install project dependencies before retrying the gate."
    return "Read the failing output, inspect the referenced files, and apply the smallest compliant fix."


def extract_files(output: str):
    found = []
    for match in FILE_RE.findall(output):
        if match not in found:
            found.append(match)
    return found


def signature_hash(name: str, output: str):
    stable_text = f"{name}:{output.strip()}"
    return hashlib.sha256(stable_text.encode("utf-8")).hexdigest()[:16]


def main():
    report = load_json(REPORT_PATH, None)
    if report is None:
        raise SystemExit("latest-report.json not found")

    learned = load_json(LEARNED_PATH, {})
    normalized = {
        "mode": report["mode"],
        "ok": report["ok"],
        "summary": report["summary"],
        "failures": [],
    }

    for check in report["checks"]:
        if check["ok"]:
            continue

        signature = signature_hash(check["name"], check["output"])
        learned_entry = learned.get(
            signature,
            {
                "signature_hash": signature,
                "first_seen_at": None,
                "last_seen_at": None,
                "occurrence_count": 0,
                "linked_doc": None,
                "linked_rule": None,
                "linked_tool": check["name"],
                "promoted_to_invariant": False,
            },
        )
        learned_entry["occurrence_count"] += 1
        learned_entry["last_seen_at"] = "latest"
        if learned_entry["first_seen_at"] is None:
            learned_entry["first_seen_at"] = "latest"
        learned[signature] = learned_entry

        failure_type = classify_failure(check["name"], check["output"])
        occurrence_count = learned_entry["occurrence_count"]
        normalized["failures"].append(
            {
                "check_name": check["name"],
                "failure_type": failure_type,
                "signature_hash": signature,
                "normalized_message": check["output"].splitlines()[0] if check["output"] else check["name"],
                "raw_output": check["output"],
                "file_paths": extract_files(check["output"]),
                "remediation_hint": remediation_hint(check["name"], check["output"]),
                "occurrence_count": occurrence_count,
                "retry_budget": RETRY_BUDGETS.get(failure_type, 0),
                "promotion_candidate": occurrence_count >= 2,
            }
        )

    save_json(NORMALIZED_PATH, normalized)
    save_json(LEARNED_PATH, learned)

    print(f"Normalized failures written to {NORMALIZED_PATH}")
    print(f"Learned failure signatures written to {LEARNED_PATH}")


if __name__ == "__main__":
    main()
