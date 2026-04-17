# Style MVP Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the RE:MEN Style MVP critical path behind explicit product docs, verification docs, and a dedicated MVP harness check.

**Architecture:** Keep the change document- and harness-focused. Product docs define the critical path and deferred scope; engineering docs define what each verification command proves; `harness/mvp/run.py` enforces that these rules stay present and linked.

**Tech Stack:** Markdown docs, Python 3 harness script, npm scripts in `package.json`, existing Next.js/Vitest/Playwright verification commands.

---

## File Structure

- Create: `docs/product/mvp-critical-path.md`
  - Owns the user-facing Style MVP path, success criteria, deferred features, and failure boundaries.

- Create: `docs/engineering/verification-matrix.md`
  - Owns the meaning of each verification command and the exact completion wording allowed after each command.

- Create: `harness/mvp/run.py`
  - Reads docs and `package.json`, then fails if MVP critical path docs, verification matrix, or `check:mvp` wiring drift.

- Modify: `package.json`
  - Add `check:mvp`.
  - Include `check:mvp` in the aggregate `check` script.

- Modify: `AGENTS.md`
  - Link to the new critical path and verification matrix docs from verification reporting rules.
  - Add concise completion wording constraints.

- Modify: `docs/index.md`
  - Add the two new docs to the index.

---

### Task 1: Product Critical Path Doc

**Files:**
- Create: `docs/product/mvp-critical-path.md`

- [ ] **Step 1: Write the product critical path document**

Create `docs/product/mvp-critical-path.md` with this exact structure:

```md
# MVP Critical Path

## Purpose

RE:MEN Style MVP는 기능을 많이 보여주는 앱이 아니라, 사용자의 현재 전신 사진과 현실 옷장 컨텍스트를 받아 바로 쓸 수 있는 스타일 추천을 제공하는 앱이다.

이 문서는 MVP에서 반드시 지켜야 할 핵심 경로와, 아직 구현된 기능처럼 표현하면 안 되는 보류 영역을 고정한다.

## Critical Path

```text
로그인
  -> 스타일 체크 시작
  -> 사진 또는 텍스트 업로드
  -> 현실 옷장 컨텍스트 포함
  -> 분석 실행
  -> 추천 조합 결과 확인
  -> 추천 반응 저장
  -> 기록 확인
  -> 비슷하게 다시 체크
```

## Must Work

- 비로그인 사용자는 `/closet`, `/history`, `/profile`, 스타일 분석 API에 접근할 수 없다.
- 로그인 사용자는 홈, 스타일, 옷장, 기록, 내 정보, 설정, 결과 화면에서 크레딧 배지를 볼 수 있어야 한다.
- 스타일 체크 시작 CTA는 기본 스타일 체크 경로로 이동해야 한다.
- 사진 또는 유효한 텍스트 설명이 없으면 분석 시작이 비활성화되어야 한다.
- 옷장 아이템이 없으면 분석 시작이 비활성화되어야 한다.
- 분석 요청은 현재 전신 사진 1장만 이미지로 포함해야 한다.
- 옷장 사진 원본은 `/api/feedback` payload에 포함하지 않는다.
- 옷장 메타데이터와 `closet_strategy`는 `/api/feedback` payload에 포함한다.
- 결과 화면은 추천 조합, 옷장 근거, 오늘 행동을 먼저 보여준다.
- 추천 반응 저장 후 다음 체크 payload에 `feedback_history`와 `preference_profile`을 포함한다.
- 기록 화면은 카드와 펼침 상세로 결과를 보여준다.
- 비슷하게 다시 체크는 옷장, 반응, 히스토리는 유지하고 현재 사진, 결과, try-on 캐시만 비운다.

## Deferred Scope

- 실착 UI는 MVP 기본 결과 화면에 노출하지 않는다.
- deep-dive 생성 CTA는 MVP 기본 결과 화면에 노출하지 않는다.
- 결제, 구독 구매, 환불 UI는 구현하지 않는다.
- 외부 상품 카탈로그, 가격, 재고, 구매 링크는 제공하지 않는다.
- 헤어, 피부, 체형, 향수 프로그램은 준비 중 구조만 유지한다.
- 운영 장애 관제나 모니터링은 이 하네스의 목적이 아니다.

## Completion Rules

- mock E2E 통과만으로 실제 Gemini 사진 분석 완료라고 말하지 않는다.
- Gemini API smoke 통과 전에는 실제 Gemini API 계약 통과라고 말하지 않는다.
- Gemini browser smoke 통과 전에는 브라우저 업로드와 실제 Gemini 경계가 통과했다고 말하지 않는다.
- visual smoke 산출물 확인 전에는 UI 배치가 확인됐다고 말하지 않는다.
- build 통과 전에는 배포 빌드 가능이라고 말하지 않는다.

## Failure Boundaries

- `auth`: 로그인 세션, refresh, middleware, 보호 페이지
- `credit`: 잔액, 차감, 환불, idempotency, 원장 불일치
- `payload`: 사진, 텍스트, 옷장, 선호 payload 누락 또는 변형
- `provider`: Gemini 또는 try-on provider 호출, 타임아웃, 응답 포맷
- `storage`: Supabase 임시 저장 또는 삭제
- `ui`: 버튼, 탭, 배지, 모달, 결과 화면, 기록 화면
- `visual`: 모바일 또는 데스크톱 화면 배치
- `harness`: 규칙이 실패를 잡지 못했거나 잘못된 완료 보고를 허용함
```

- [ ] **Step 2: Verify the doc exists**

Run:

```bash
test -f docs/product/mvp-critical-path.md
```

Expected: exits with code `0`.

- [ ] **Step 3: Commit**

```bash
git add docs/product/mvp-critical-path.md
git commit -m "docs: define style mvp critical path"
```

---

### Task 2: Verification Matrix Doc

**Files:**
- Create: `docs/engineering/verification-matrix.md`

- [ ] **Step 1: Write the verification matrix**

Create `docs/engineering/verification-matrix.md` with this exact structure:

```md
# Verification Matrix

## Purpose

검증 명령은 모두 같은 의미가 아니다.
이 문서는 각 명령이 무엇을 증명하는지와, 완료 보고에서 사용할 수 있는 문구를 고정한다.

## Commands

| Command | Proves | Completion wording |
|---|---|---|
| `npm run typecheck` | TypeScript 타입 경계가 깨지지 않음 | typecheck 통과 |
| `npm run lint` | ESLint 규칙 위반 없음 | lint 통과 |
| `npm run test:unit` | 순수 함수, 계약, 크레딧 계산, 추천 매칭 단위 검증 | unit tests 통과 |
| `npm run test:integration` | API route, auth, credit, middleware 통합 경계 검증 | integration tests 통과 |
| `npm run check:repo` | 루트 문서와 repository harness 규칙 검증 | repository harness 통과 |
| `npm run check:app` | agent contract fixtures 검증 | application harness 통과 |
| `npm run check:content` | 금지 표현과 구매 유도 content rule 검증 | content rules 통과 |
| `npm run check:architecture` | 구조 규칙 검증 | architecture harness 통과 |
| `npm run check:gc` | 문서/코드 drift와 GC 규칙 검증 | gc harness 통과 |
| `npm run check:mvp` | MVP critical path와 verification matrix 문서/스크립트 연결 검증 | MVP harness 통과 |
| `npm run test:e2e` | mock provider 기반 브라우저 사용자 흐름 검증 | mock E2E 통과 |
| `npm run smoke:feedback:gemini` | 실제 Gemini API 응답 계약 검증 | 실제 Gemini API 계약 통과 |
| `npm run smoke:feedback:browser` | 브라우저 업로드 흐름과 실제 Gemini 경계 검증 | 브라우저 업로드와 실제 Gemini 경계 통과 |
| `npm run visual:app` | 홈, 스타일, 업로드, 분석, 결과, 옷장, 기록, 내 정보, 설정 화면의 캡처 생성 | visual smoke 통과 및 산출물 확인 |
| `npm run build` | Next.js production build 가능 | build 통과 |

## Sequential Commands

아래 명령은 `.next` 또는 3001 포트 브라우저 서버를 공유하므로 병렬 실행하지 않는다.

- `npm run test:e2e`
- `npm run visual:app`
- `npm run visual:deep-dive`
- `npm run build`

이 명령들은 `scripts/with-next-artifact-lock.py`를 통해 실행되어야 한다.

## Forbidden Reporting

- `npm run test:e2e`만 실행하고 실제 Gemini 사진 분석이 된다고 말하지 않는다.
- `npm run typecheck`와 `npm run lint`만 실행하고 사용자 플로우가 통과했다고 말하지 않는다.
- `npm run visual:app`을 실행하지 않고 UI 배치가 확인됐다고 말하지 않는다.
- 실패한 명령이 있으면 숨기지 않는다.
- 실패는 `auth`, `credit`, `payload`, `provider`, `storage`, `ui`, `visual`, `harness` 중 하나로 분류한다.

## Visual Evidence

`npm run visual:app`이 생성하는 주요 산출물은 아래 위치에 있다.

- `output/playwright/app-visual-smoke/mobile-home.png`
- `output/playwright/app-visual-smoke/mobile-style.png`
- `output/playwright/app-visual-smoke/mobile-upload.png`
- `output/playwright/app-visual-smoke/mobile-result.png`
- `output/playwright/app-visual-smoke/mobile-closet.png`
- `output/playwright/app-visual-smoke/mobile-history.png`
- `output/playwright/app-visual-smoke/mobile-profile.png`
- `output/playwright/app-visual-smoke/mobile-settings.png`
- `output/playwright/app-visual-smoke/desktop-home.png`
- `output/playwright/app-visual-smoke/desktop-style.png`
- `output/playwright/app-visual-smoke/desktop-result.png`
- `output/playwright/app-visual-smoke/desktop-closet.png`
```

- [ ] **Step 2: Verify key command names are present**

Run:

```bash
rg -n "smoke:feedback:gemini|smoke:feedback:browser|visual:app|check:mvp" docs/engineering/verification-matrix.md
```

Expected: all four command names appear.

- [ ] **Step 3: Commit**

```bash
git add docs/engineering/verification-matrix.md
git commit -m "docs: add mvp verification matrix"
```

---

### Task 3: MVP Harness Script

**Files:**
- Create: `harness/mvp/run.py`

- [ ] **Step 1: Create the failing harness expectation**

Before writing the script, run:

```bash
python3 harness/mvp/run.py
```

Expected: FAIL because `harness/mvp/run.py` does not exist yet.

- [ ] **Step 2: Implement `harness/mvp/run.py`**

Create `harness/mvp/run.py`:

```python
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


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


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

    package_json = json.loads(package_path.read_text(encoding="utf-8"))
    scripts = package_json.get("scripts", {})
    failures = []

    check_mvp = scripts.get("check:mvp", "")
    aggregate_check = scripts.get("check", "")

    if "python3 harness/mvp/run.py" not in check_mvp:
        failures.append("package.json script check:mvp must run python3 harness/mvp/run.py")

    if "npm run check:mvp" not in aggregate_check:
        failures.append("package.json script check must include npm run check:mvp")

    for pattern in PACKAGE_SCRIPT_PATTERNS:
        if pattern not in package_path.read_text(encoding="utf-8"):
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
```

- [ ] **Step 3: Run the harness and verify it fails for missing docs/wiring**

Run:

```bash
python3 harness/mvp/run.py
```

Expected: FAIL until Tasks 1, 2, 4, and 5 are complete.

- [ ] **Step 4: Commit**

```bash
git add harness/mvp/run.py
git commit -m "test: add style mvp harness"
```

---

### Task 4: Wire `check:mvp`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update scripts**

Modify `package.json` scripts so they include:

```json
{
  "check:mvp": "python3 harness/mvp/run.py",
  "check": "python3 harness/repository/run.py && python3 harness/application/run.py && python3 harness/application/content_rules.py && python3 harness/architecture/run.py && python3 harness/gc/run.py && npm run check:mvp && tsc --noEmit && next lint && next build"
}
```

Keep all existing scripts unchanged except the new `check:mvp` entry and the aggregate `check` entry.

- [ ] **Step 2: Verify package JSON parses**

Run:

```bash
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('ok')"
```

Expected:

```text
ok
```

- [ ] **Step 3: Run MVP harness and expect remaining doc failures only**

Run:

```bash
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run check:mvp
```

Expected: FAIL only if Tasks 1, 2, or 5 are not complete. If those tasks are complete, PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: wire style mvp harness"
```

---

### Task 5: Link Docs From AGENTS and Index

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/index.md`

- [ ] **Step 1: Update `AGENTS.md` verification reporting rules**

In `AGENTS.md`, under `## 검증 보고 규칙`, add this block after the existing smoke/browser validation bullets:

```md
- MVP 핵심 경로와 완료 보고 기준은 `docs/product/mvp-critical-path.md`와 `docs/engineering/verification-matrix.md`를 따른다.
- `npm run test:e2e` 통과는 `mock E2E 통과`로만 보고한다.
- `npm run smoke:feedback:gemini` 통과는 `실제 Gemini API 계약 통과`로 보고한다.
- `npm run smoke:feedback:browser` 통과는 `브라우저 업로드와 실제 Gemini 경계 통과`로 보고한다.
- `npm run visual:app` 산출물을 확인한 경우에만 `UI 배치 확인`으로 보고한다.
- `npm run build` 통과는 `build 통과`로 보고한다.
```

- [ ] **Step 2: Update `docs/index.md` product links**

In the Product section, add:

```md
- [mvp-critical-path.md](/Users/gojaewoong/Desktop/ko/nerd/docs/product/mvp-critical-path.md)
```

Place it next to `mvp-priorities.md` and `mvp-implementation-audit.md`.

- [ ] **Step 3: Update `docs/index.md` engineering links**

In the Engineering section, add:

```md
- [verification-matrix.md](/Users/gojaewoong/Desktop/ko/nerd/docs/engineering/verification-matrix.md)
```

Place it near `save-gate.md` and `required-checks.md`.

- [ ] **Step 4: Run MVP harness**

Run:

```bash
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run check:mvp
```

Expected:

```text
PASS critical-path-doc
PASS verification-matrix-doc
PASS agents-reporting-rules
PASS docs-index-links
PASS package-scripts

MVP harness passed.
```

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md docs/index.md
git commit -m "docs: link mvp reliability rules"
```

---

### Task 6: Final Verification

**Files:**
- No source changes unless a verification failure requires a fix.

- [ ] **Step 1: Run fast checks in parallel-safe groups**

Run these commands. They do not use `.next` browser server and can be run in parallel by the orchestrating agent:

```bash
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run typecheck
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run lint
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:unit
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:integration
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run check:repo
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run check:app
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run check:content
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run check:architecture
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run check:gc
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run check:mvp
```

Expected: all pass.

- [ ] **Step 2: Run browser E2E sequentially**

Run:

```bash
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test:e2e -- --project=chromium tests/e2e/onboarding.spec.ts
```

Expected: all tests pass. Report as `mock E2E 통과`.

- [ ] **Step 3: Run visual smoke sequentially**

Run:

```bash
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run visual:app
```

Expected: command passes and prints `output/playwright/app-visual-smoke/*.png` paths.

Manually inspect at least:

```text
output/playwright/app-visual-smoke/mobile-home.png
output/playwright/app-visual-smoke/mobile-result.png
output/playwright/app-visual-smoke/mobile-closet.png
output/playwright/app-visual-smoke/mobile-history.png
output/playwright/app-visual-smoke/desktop-home.png
output/playwright/app-visual-smoke/desktop-result.png
```

Report as `visual smoke 통과 및 산출물 확인`.

- [ ] **Step 4: Run production build sequentially**

Run:

```bash
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run build
```

Expected: Next.js production build completes. Report as `build 통과`.

- [ ] **Step 5: Optional Gemini smoke**

Only run if local env has valid `AI_PROVIDER=gemini` and `GOOGLE_API_KEY`/`GEMINI_API_KEY`:

```bash
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run smoke:feedback:gemini
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run smoke:feedback:browser
```

Expected:

- `smoke:feedback:gemini`: actual Gemini API contract passes.
- `smoke:feedback:browser`: browser upload and actual Gemini boundary passes.

If skipped, final report must say Gemini smoke was not run and must not claim real Gemini photo analysis validation.

- [ ] **Step 6: Commit verification-only fixes if any**

If any verification failure required a code/doc fix:

```bash
git add <changed-files>
git commit -m "fix: satisfy style mvp reliability gate"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: This plan implements the approved spec by adding the critical path doc, verification matrix doc, AGENTS reporting rules, MVP harness, `check:mvp`, index links, and final verification sequence.
- Placeholder scan: No `TBD`, `TODO`, "implement later", or unbounded "add appropriate" steps remain. Optional Gemini smoke is explicit and scoped to environment availability.
- Type consistency: File paths and command names match the existing repo conventions and the approved spec.
