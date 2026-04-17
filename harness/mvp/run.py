#!/usr/bin/env python3

import json
import sys
from pathlib import Path


ROOT = Path.cwd()

CHECKS = [
    {
        "id": "critical-path-doc",
        "file": "docs/product/mvp-critical-path.md",
        "patterns": [
            "로그인",
            "사진 또는 텍스트 업로드",
            "현실 옷장 컨텍스트 포함",
            "추천 반응 저장",
            "비슷하게 다시 체크",
            "옷장 사진 원본은 `/api/feedback` payload에 포함하지 않는다",
            "실착 UI는 MVP 기본 결과 화면에 노출하지 않는다",
            "조합 느낌 보기",
            "`조합 느낌 보기`는 `/api/try-on`을 호출하지 않는다",
            "운영 장애 관제나 모니터링은 이 하네스의 목적이 아니다",
        ],
    },
    {
        "id": "verification-matrix-doc",
        "file": "docs/engineering/verification-matrix.md",
        "patterns": [
            "`npm run test:e2e`",
            "`npm run smoke:feedback:gemini`",
            "`npm run smoke:feedback:browser`",
            "`npm run visual:app`",
            "`npm run build`",
            "mock E2E 통과",
            "실제 Gemini API 계약 통과",
            "visual smoke 통과 및 산출물 확인",
            "scripts/with-next-artifact-lock.py",
        ],
    },
    {
        "id": "agents-reporting-rules",
        "file": "AGENTS.md",
        "patterns": [
            "docs/product/mvp-critical-path.md",
            "docs/engineering/verification-matrix.md",
            "mock E2E",
            "실제 Gemini API 계약",
            "브라우저 업로드와 실제 Gemini 경계",
            "UI 배치 확인",
        ],
    },
    {
        "id": "docs-index-links",
        "file": "docs/index.md",
        "patterns": [
            "mvp-critical-path.md",
            "verification-matrix.md",
        ],
    },
]

PACKAGE_SCRIPT_PATTERNS = [
    "check:mvp",
    "python3 harness/mvp/run.py",
]


def print_result(ok: bool, message: str):
    prefix = "PASS" if ok else "FAIL"
    print(f"{prefix} {message}")


def check_file_patterns(check: dict[str, object]) -> list[str]:
    relative_path = str(check["file"])
    path = ROOT / relative_path

    if not path.exists():
        return [f"missing required file: {relative_path}"]

    content = path.read_text(encoding="utf-8")
    failures = []

    for pattern in check["patterns"]:
        if str(pattern) not in content:
            failures.append(f"{relative_path} is missing '{pattern}'")

    return failures


def check_package_scripts() -> list[str]:
    package_path = ROOT / "package.json"

    if not package_path.exists():
        return ["missing required file: package.json"]

    package_text = package_path.read_text(encoding="utf-8")
    package_json = json.loads(package_text)
    scripts = package_json.get("scripts", {})
    failures = []

    check_mvp = scripts.get("check:mvp", "")
    aggregate_check = scripts.get("check", "")

    if "python3 harness/mvp/run.py" not in check_mvp:
        failures.append("package.json script check:mvp must run python3 harness/mvp/run.py")

    if "npm run check:mvp" not in aggregate_check:
        failures.append("package.json script check must include npm run check:mvp")

    for pattern in PACKAGE_SCRIPT_PATTERNS:
        if pattern not in package_text:
            failures.append(f"package.json is missing '{pattern}'")

    return failures


def main() -> int:
    failures: list[str] = []

    for check in CHECKS:
        check_failures = check_file_patterns(check)

        if check_failures:
            print_result(False, str(check["id"]))
            for failure in check_failures:
                print_result(False, f"  {failure}")
            failures.extend(check_failures)
        else:
            print_result(True, str(check["id"]))

    package_failures = check_package_scripts()

    if package_failures:
        print_result(False, "package-scripts")
        for failure in package_failures:
            print_result(False, f"  {failure}")
        failures.extend(package_failures)
    else:
        print_result(True, "package-scripts")

    if failures:
        print(f"\nMVP harness failed with {len(failures)} issue(s).", file=sys.stderr)
        return 1

    print("\nMVP harness passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
