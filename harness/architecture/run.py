#!/usr/bin/env python3

import re
import sys
from pathlib import Path


ROOT = Path.cwd()
IMPORT_RE = re.compile(r'from\s+["\']([^"\']+)["\']')
ARCH_DOC = ROOT / "docs" / "engineering" / "architecture.md"
FEEDBACK_ROUTE = ROOT / "app" / "api" / "feedback" / "route.ts"
DAILY_ROUTE = ROOT / "app" / "api" / "daily" / "route.ts"
TEMP_IMAGE_HELPER = ROOT / "lib" / "supabase" / "temp-image.ts"


def print_result(ok: bool, message: str):
    prefix = "PASS" if ok else "FAIL"
    print(f"{prefix} {message}")


def iter_source_files(base: Path):
    if not base.exists():
        return []
    return [path for path in base.rglob("*") if path.suffix in {".ts", ".tsx"} and path.is_file()]


def boundary_failures():
    failures = []

    for path in iter_source_files(ROOT / "components"):
        text = path.read_text(encoding="utf-8")
        for imported in IMPORT_RE.findall(text):
            if imported.startswith("@/app/api/"):
                failures.append(
                    f"{path.relative_to(ROOT)} must not import API route module {imported}"
                )

    for path in iter_source_files(ROOT / "lib"):
        text = path.read_text(encoding="utf-8")
        for imported in IMPORT_RE.findall(text):
            if imported.startswith("@/components/") or imported.startswith("@/app/"):
                failures.append(
                    f"{path.relative_to(ROOT)} must stay below UI/app layer, found import {imported}"
                )

    for path in iter_source_files(ROOT / "app" / "api"):
        text = path.read_text(encoding="utf-8")
        for imported in IMPORT_RE.findall(text):
            if imported.startswith("@/components/"):
                failures.append(
                    f"{path.relative_to(ROOT)} must not import UI component module {imported}"
                )

    return failures


def doc_contract_failures():
    failures = []
    doc_text = ARCH_DOC.read_text(encoding="utf-8")
    required_routes = ["/api/feedback", "/api/daily", "/api/email"]

    for route in required_routes:
        if route not in doc_text:
            failures.append(f"{ARCH_DOC.relative_to(ROOT)} is missing documented route {route}")

    required_files = [
        ROOT / "app" / "api" / "feedback" / "route.ts",
        ROOT / "app" / "api" / "daily" / "route.ts",
        ROOT / "app" / "api" / "email" / "route.ts",
    ]
    for file_path in required_files:
        if not file_path.exists():
            failures.append(f"missing required route file {file_path.relative_to(ROOT)}")

    return failures


def storage_contract_failures():
    failures = []

    route_expectations = [
        (FEEDBACK_ROUTE, 'withTemporaryStoredImage(', 'feedback route must use temp storage wrapper'),
        (FEEDBACK_ROUTE, 'recordStorageRuntimeFailure(', 'feedback route must record storage runtime failures'),
        (DAILY_ROUTE, 'withTemporaryStoredImage(', 'daily route must use temp storage wrapper'),
        (DAILY_ROUTE, 'recordStorageRuntimeFailure(', 'daily route must record storage runtime failures'),
    ]

    for path, needle, message in route_expectations:
        if not path.exists():
            failures.append(f"missing required file {path.relative_to(ROOT)}")
            continue

        text = path.read_text(encoding="utf-8")
        if needle not in text:
            failures.append(f"{path.relative_to(ROOT)}: {message}")

    if not TEMP_IMAGE_HELPER.exists():
        failures.append(f"missing required file {TEMP_IMAGE_HELPER.relative_to(ROOT)}")
        return failures

    helper_text = TEMP_IMAGE_HELPER.read_text(encoding="utf-8")
    helper_needles = [
        ("finally {", "temp-image helper must delete in a finally block"),
        ("await deleteImageFromSupabaseStorage(uploadedImage);", "temp-image helper must delete uploaded image after work"),
        ('failureMode === "delete"', "temp-image helper must support delete failure injection"),
        ('failureMode === "upload"', "temp-image helper must support upload failure injection"),
    ]

    for needle, message in helper_needles:
        if needle not in helper_text:
            failures.append(f"{TEMP_IMAGE_HELPER.relative_to(ROOT)}: {message}")

    return failures


def main():
    failures = []
    failures.extend(boundary_failures())
    failures.extend(doc_contract_failures())
    failures.extend(storage_contract_failures())

    if failures:
        print_result(False, "architecture")
        for failure in failures:
            print_result(False, f"  {failure}")
        print(f"\nArchitecture harness failed with {len(failures)} issue(s).", file=sys.stderr)
        return 1

    print_result(True, "architecture")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
