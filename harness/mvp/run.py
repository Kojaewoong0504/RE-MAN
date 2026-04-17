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
            "상의, 하의, 신발 중 하나라도 없으면 분석 시작이 비활성화",
            "추천 반응 저장",
            "비슷하게 다시 체크",
            "옷장 사진 원본은 `/api/feedback` payload에 포함하지 않는다",
            "`closet_strategy`는 착용감, 착용 빈도, 계절, 상태, 메모를 점수화",
            "provider가 반환한 `source_item_ids`는 현재 `closet_items`의 같은 카테고리 id로 검증",
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

BASIS_UI_REQUIRED_LABELS = [
    "추천에 사용",
    "비슷한 후보",
    "추가 후보",
    "자주 입고 잘 맞음",
    "핏/상태 확인",
    "후보",
]

BASIS_UI_DOC_FILES = [
    "AGENTS.md",
    "docs/product/closet-recommendation-basis.md",
    "docs/product/style-check-session.md",
    "docs/product/style-history.md",
]

BASIS_UI_SOURCE_FILES = [
    "lib/product/closet-basis.ts",
    "app/onboarding/result/page.tsx",
    "app/history/page.tsx",
]

BASIS_UI_RENDER_FILES = [
    "app/onboarding/result/page.tsx",
    "app/history/page.tsx",
]

BASIS_UI_LEGACY_LABELS = [
    "직접 매칭",
    "근거 후보",
    "추천에 직접 사용",
    "가장 가까운 옷",
    "있으면 추가",
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


def check_basis_ui_labels() -> list[str]:
    failures: list[str] = []
    doc_text = "\n".join(
        (ROOT / relative_path).read_text(encoding="utf-8")
        for relative_path in BASIS_UI_DOC_FILES
        if (ROOT / relative_path).exists()
    )
    source_text = "\n".join(
        (ROOT / relative_path).read_text(encoding="utf-8")
        for relative_path in BASIS_UI_SOURCE_FILES
        if (ROOT / relative_path).exists()
    )
    render_text = "\n".join(
        (ROOT / relative_path).read_text(encoding="utf-8")
        for relative_path in BASIS_UI_RENDER_FILES
        if (ROOT / relative_path).exists()
    )

    for relative_path in [*BASIS_UI_DOC_FILES, *BASIS_UI_SOURCE_FILES]:
        if not (ROOT / relative_path).exists():
            failures.append(f"missing required basis UI file: {relative_path}")

    for label in BASIS_UI_REQUIRED_LABELS:
        if label not in doc_text:
            failures.append(f"basis UI docs are missing '{label}'")

    for label in ["추천에 사용", "비슷한 후보", "추가 후보"]:
        if label not in source_text:
            failures.append(f"basis UI source is missing '{label}'")

    for legacy_label in BASIS_UI_LEGACY_LABELS:
        if legacy_label in source_text:
            failures.append(f"basis UI source still exposes legacy label '{legacy_label}'")

    if "score" in render_text:
        failures.append("basis UI render files must not expose internal score")

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

    basis_ui_failures = check_basis_ui_labels()

    if basis_ui_failures:
        print_result(False, "basis-ui-labels")
        for failure in basis_ui_failures:
            print_result(False, f"  {failure}")
        failures.extend(basis_ui_failures)
    else:
        print_result(True, "basis-ui-labels")

    if failures:
        print(f"\nMVP harness failed with {len(failures)} issue(s).", file=sys.stderr)
        return 1

    print("\nMVP harness passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
