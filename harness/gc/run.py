#!/usr/bin/env python3

import re
import sys
from pathlib import Path


ROOT = Path.cwd()
SCAN_DIRS = [ROOT / "app", ROOT / "components", ROOT / "lib"]
IMPORT_RE = re.compile(r'from\s+["\'](@/[^"\']+|\.{1,2}/[^"\']+)["\']')
FORBIDDEN_PATTERNS = ["console.log", "TODO", "FIXME", "HACK"]


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


def main():
    failures = []
    failures.extend(find_unreferenced_files())
    failures.extend(find_forbidden_patterns())

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
