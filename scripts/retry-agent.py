#!/usr/bin/env python3

import json
from pathlib import Path


ROOT = Path.cwd()
NORMALIZED_PATH = ROOT / "harness" / "reports" / "normalized-failures.json"
OUTPUT_PATH = ROOT / "harness" / "reports" / "repair-context.json"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    normalized = load_json(NORMALIZED_PATH)
    docs_to_consult = [
        "CONSTITUTION.md",
        "AGENTS.md",
        "HARNESS_ENGINEERING.md",
        "docs/engineering/failure-to-rule.md",
    ]

    payload = {
        "status": "failed" if normalized["failures"] else "passed",
        "mode": normalized["mode"],
        "attempt": 1,
        "retry_budget": max((failure["retry_budget"] for failure in normalized["failures"]), default=0),
        "docs_to_consult": docs_to_consult,
        "failures": [
            {
                "check_name": failure["check_name"],
                "failure_type": failure["failure_type"],
                "signature_hash": failure["signature_hash"],
                "file_paths": failure["file_paths"],
                "normalized_message": failure["normalized_message"],
                "remediation_hint": failure["remediation_hint"],
                "occurrence_count": failure["occurrence_count"],
                "promotion_candidate": failure["promotion_candidate"],
            }
            for failure in normalized["failures"]
        ],
        "instruction": (
            "Fix only the reported failures, consult the listed docs first, keep changes minimal, "
            "and rerun the same gate after editing."
        ),
    }

    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Repair context written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
