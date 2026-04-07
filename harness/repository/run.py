#!/usr/bin/env python3

import json
import sys
from pathlib import Path


ROOT = Path.cwd()
CONFIG_PATH = ROOT / "harness" / "repository" / "contracts.json"


def load_config():
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def read_text(relative_path):
    return (ROOT / relative_path).read_text(encoding="utf-8")


def print_result(ok, message):
    prefix = "PASS" if ok else "FAIL"
    print(f"{prefix} {message}")


def check_required_files(required_files):
    failures = []
    for relative_path in required_files:
        if not (ROOT / relative_path).exists():
            failures.append(f"missing required file: {relative_path}")
    return failures


def check_patterns(file_paths, patterns):
    failures = []
    for file_path in file_paths:
        content = read_text(file_path)
        for pattern in patterns:
            if pattern not in content:
                failures.append(f"{file_path} is missing '{pattern}'")
    return failures


def main():
    config = load_config()
    failures = []

    required_file_failures = check_required_files(config["required_files"])
    if required_file_failures:
        print_result(False, "required-files")
        for failure in required_file_failures:
            print_result(False, f"  {failure}")
        failures.extend(required_file_failures)
    else:
        print_result(True, "required-files")

    for check in config["checks"]:
        files = check["files"] if "files" in check else [check["file"]]
        check_failures = check_patterns(files, check["patterns"])

        if check_failures:
            print_result(False, f"{check['id']}: {check['description']}")
            for failure in check_failures:
                print_result(False, f"  {failure}")
            failures.extend(f"{check['id']}: {failure}" for failure in check_failures)
        else:
            print_result(True, f"{check['id']}: {check['description']}")

    if failures:
        print(f"\nRepository harness failed with {len(failures)} issue(s).", file=sys.stderr)
        return 1

    print("\nRepository harness passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
