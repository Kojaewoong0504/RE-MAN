#!/usr/bin/env python3

import re
import sys
import json
from pathlib import Path


ROOT = Path.cwd()
SCAN_DIRS = [ROOT / "app", ROOT / "components", ROOT / "lib"]
IMPORT_RE = re.compile(r'from\s+["\'](@/[^"\']+|\.{1,2}/[^"\']+)["\']')
FORBIDDEN_PATTERNS = ["console.log", "TODO", "FIXME", "HACK"]
DOC_ROUTE_EXPECTATIONS = {
    "/api/feedback": ROOT / "app" / "api" / "feedback" / "route.ts",
    "/api/daily": ROOT / "app" / "api" / "daily" / "route.ts",
    "/api/email": ROOT / "app" / "api" / "email" / "route.ts",
}
STALE_FLAG_PATTERNS = ["FEATURE_FLAG", "TEMP_FLAG", "LEGACY_FLAG"]


def print_result(ok: bool, message: str):
    prefix = "PASS" if ok else "FAIL"
    print(f"{prefix} {message}")


def source_files():
    for base in SCAN_DIRS:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.suffix in {".ts", ".tsx"} and path.is_file():
                yield path


def normalize_import(current_file: Path, import_path: str):
    if import_path.startswith("@/"):
        return (ROOT / import_path[2:]).resolve()
    return (current_file.parent / import_path).resolve()


def build_reference_map():
    refs = set()
    for path in source_files():
        text = path.read_text(encoding="utf-8")
        for match in IMPORT_RE.findall(text):
            target = normalize_import(path, match)
            refs.add(target.with_suffix(".ts"))
            refs.add(target.with_suffix(".tsx"))
            refs.add((target / "index.ts").resolve())
            refs.add((target / "index.tsx").resolve())
    return refs


def find_unreferenced_files():
    refs = build_reference_map()
    failures = []

    for path in source_files():
        if path.is_relative_to(ROOT / "app"):
            continue
        if path.name.startswith("index."):
            continue
        if path.resolve() not in refs:
            failures.append(f"unreferenced source file: {path.relative_to(ROOT)}")

    return failures


def find_forbidden_patterns():
    failures = []
    for path in source_files():
        text = path.read_text(encoding="utf-8")
        for pattern in FORBIDDEN_PATTERNS:
            if pattern in text:
                failures.append(f"{path.relative_to(ROOT)} contains '{pattern}'")
    return failures


def write_candidates(candidates):
    report_path = ROOT / "harness" / "reports" / "gc-candidates.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(candidates, ensure_ascii=False, indent=2), encoding="utf-8")


def find_doc_drift():
    failures = []
    architecture_text = (ROOT / "docs" / "engineering" / "architecture.md").read_text(encoding="utf-8")
    for route, file_path in DOC_ROUTE_EXPECTATIONS.items():
        if route not in architecture_text:
            failures.append(f"doc drift: architecture.md is missing route {route}")
        if not file_path.exists():
            failures.append(f"doc drift: missing route file {file_path.relative_to(ROOT)}")
    return failures


def find_candidate_duplicates():
    duplicates = []
    text_to_files = {}

    for path in source_files():
        lines = [
            line.strip()
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.strip().startswith(("import ", "export ", "//"))
        ]
        for line in lines:
            if len(line) < 80:
                continue
            text_to_files.setdefault(line, set()).add(str(path.relative_to(ROOT)))

    for line, files in text_to_files.items():
        if len(files) > 1:
            duplicates.append(
                {
                    "category": "duplicate_logic_candidate",
                    "evidence": line,
                    "files": sorted(files),
                }
            )
    return duplicates


def find_stale_flag_candidates():
    findings = []
    for path in source_files():
        text = path.read_text(encoding="utf-8")
        for pattern in STALE_FLAG_PATTERNS:
            if pattern in text:
                findings.append(
                    {
                        "category": "stale_flag_candidate",
                        "pattern": pattern,
                        "file": str(path.relative_to(ROOT)),
                    }
                )
    return findings


def main():
    failures = []
    candidates = []
    failures.extend(find_unreferenced_files())
    failures.extend(find_forbidden_patterns())
    failures.extend(find_doc_drift())
    candidates.extend(find_candidate_duplicates())
    candidates.extend(find_stale_flag_candidates())
    write_candidates(candidates)

    if failures:
        print_result(False, "gc")
        for failure in failures:
            print_result(False, f"  {failure}")
        print(f"\nGC harness failed with {len(failures)} issue(s).", file=sys.stderr)
        return 1

    print_result(True, "gc")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
