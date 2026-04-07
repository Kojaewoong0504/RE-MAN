#!/usr/bin/env python3

import json
import sys
from pathlib import Path


ROOT = Path.cwd()
CONTRACTS_PATH = ROOT / "harness" / "application" / "contracts.json"
FIXTURES_DIR = ROOT / "harness" / "application" / "fixtures"


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def print_result(ok, message):
    prefix = "PASS" if ok else "FAIL"
    print(f"{prefix} {message}")


def validate_response(agent_name, response, contract):
    failures = []

    for field in contract["required_fields"]:
        if field not in response:
            failures.append(f"missing required field '{field}'")

    for field in contract["forbidden_fields"]:
        if field in response:
            failures.append(f"contains forbidden field '{field}'")

    improvements = response.get("improvements")
    if not isinstance(improvements, list):
        failures.append("field 'improvements' must be an array")
    else:
        if len(improvements) != contract["improvements_count"]:
            failures.append(
                f"field 'improvements' must contain exactly {contract['improvements_count']} items"
            )
        for index, item in enumerate(improvements, start=1):
            if not isinstance(item, str) or not item.strip():
                failures.append(f"improvements[{index}] must be a non-empty string")

    for field in contract["required_fields"]:
        if field == "improvements":
            continue
        if field in response and (not isinstance(response[field], str) or not response[field].strip()):
            failures.append(f"field '{field}' must be a non-empty string")

    return failures


def main():
    contracts = load_json(CONTRACTS_PATH)["agents"]
    failures = []

    for agent_name, contract in contracts.items():
        fixture_path = FIXTURES_DIR / f"{agent_name}.valid.json"
        if not fixture_path.exists():
            message = f"{agent_name}: missing fixture {fixture_path.relative_to(ROOT)}"
            print_result(False, message)
            failures.append(message)
            continue

        response = load_json(fixture_path)
        check_failures = validate_response(agent_name, response, contract)

        if check_failures:
            print_result(False, f"{agent_name} contract")
            for failure in check_failures:
                print_result(False, f"  {failure}")
            failures.extend(f"{agent_name}: {failure}" for failure in check_failures)
        else:
            print_result(True, f"{agent_name} contract")

    if failures:
        print(f"\nApplication harness failed with {len(failures)} issue(s).", file=sys.stderr)
        return 1

    print("\nApplication harness passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
