#!/usr/bin/env python3

import json
from datetime import datetime
from pathlib import Path


ROOT = Path.cwd()
NORMALIZED_PATH = ROOT / "harness" / "reports" / "normalized-failures.json"
INCIDENTS_DIR = ROOT / "docs" / "incidents"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def slugify(text: str):
    return "".join(ch.lower() if ch.isalnum() else "-" for ch in text).strip("-")


def main():
    normalized = load_json(NORMALIZED_PATH)
    failures = normalized["failures"]
    if not failures:
        print("No failures to log.")
        return

    first = failures[0]
    date_prefix = datetime.now().strftime("%Y-%m-%d")
    filename = f"{date_prefix}-{slugify(first['check_name'])}-{first['signature_hash']}.md"
    INCIDENTS_DIR.mkdir(parents=True, exist_ok=True)
    target = INCIDENTS_DIR / filename

    lines = [
        f"# Incident: {first['check_name']}",
        "",
        "## Classification",
        f"- type: `{first['failure_type']}`",
        f"- signature: `{first['signature_hash']}`",
        f"- promotion_candidate: `{first.get('promotion_candidate', False)}`",
        "",
        "## Symptom",
        first["normalized_message"],
        "",
        "## Root Cause",
        "To be filled after investigation.",
        "",
        "## Evidence",
    ]
    for failure in failures:
        lines.append(f"- check: `{failure['check_name']}`")
        lines.append(f"- type: `{failure['failure_type']}`")
        lines.append(f"- signature: `{failure['signature_hash']}`")
        lines.append(f"- remediation hint: {failure['remediation_hint']}")
        lines.append(f"- promotion candidate: `{failure.get('promotion_candidate', False)}`")
        if failure["file_paths"]:
            lines.append(f"- files: {', '.join(failure['file_paths'])}")
        lines.append("")

    lines.extend(
        [
            "## Prevent Recurrence",
            "- Update the relevant docs or rules.",
            "- Add or strengthen a harness, gate, or GC check.",
            "- Link the follow-up rule promotion in `docs/engineering/failure-to-rule.md` if needed.",
        ]
    )

    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Incident written to {target}")


if __name__ == "__main__":
    main()
