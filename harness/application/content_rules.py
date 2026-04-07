#!/usr/bin/env python3

import json
import sys
from pathlib import Path


ROOT = Path.cwd()
FIXTURES_DIR = ROOT / "harness" / "application" / "fixtures"
MOCK_FEEDBACK = ROOT / "lib" / "agents" / "mock-feedback.ts"

FORBIDDEN_PHRASES = [
    "왜 이렇게 입었어요",
    "이건 좀 아닌 것 같아요",
]

ONBOARDING_BUY_WORDS = [
    "구매",
    "쇼핑",
    "사세요",
    "구입",
]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def print_result(ok: bool, message: str):
    prefix = "PASS" if ok else "FAIL"
    print(f"{prefix} {message}")


def assert_no_forbidden_phrases(name: str, text: str):
    failures = []
    for phrase in FORBIDDEN_PHRASES:
        if phrase in text:
            failures.append(f"{name} contains forbidden phrase '{phrase}'")
    return failures


def collect_texts(payload):
    texts = []
    if isinstance(payload, dict):
        for value in payload.values():
            texts.extend(collect_texts(value))
    elif isinstance(payload, list):
        for value in payload:
            texts.extend(collect_texts(value))
    elif isinstance(payload, str):
        texts.append(payload)
    return texts


def main():
    failures = []

    onboarding_fixture = load_json(FIXTURES_DIR / "onboarding-agent.valid.json")
    daily_fixture = load_json(FIXTURES_DIR / "daily-agent.valid.json")
    mock_feedback_text = MOCK_FEEDBACK.read_text(encoding="utf-8")

    for label, payload in [
        ("onboarding fixture", onboarding_fixture),
        ("daily fixture", daily_fixture),
    ]:
        for text in collect_texts(payload):
            failures.extend(assert_no_forbidden_phrases(label, text))

    for phrase in ONBOARDING_BUY_WORDS:
        haystacks = [
            onboarding_fixture.get("today_action", ""),
            onboarding_fixture.get("day1_mission", ""),
            mock_feedback_text,
        ]
        for haystack in haystacks:
            if phrase in haystack:
                failures.append(f"onboarding flow contains buy word '{phrase}' before Day 6")

    if failures:
        print_result(False, "content-rules")
        for failure in failures:
            print_result(False, f"  {failure}")
        print(f"\nContent rules failed with {len(failures)} issue(s).", file=sys.stderr)
        return 1

    print_result(True, "content-rules")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
