# HARNESS_BOOTSTRAP_PLAYBOOK.md

## Purpose

이 문서는 새로운 서비스에 하네스 엔지니어링을 이식할 때 그대로 가져다 쓸 수 있는 부트스트랩 플레이북이다.
목표는 "AI가 잘하길 기대하는 개발"이 아니라, "실수해도 구조가 막고 다시 고치게 만드는 개발 시스템"을 처음부터 심는 것이다.
여기서 말하는 하네스는 개발 중 구조 제약과 자기교정 파이프라인을 뜻한다.
운영 중 장애 관제나 프로덕션 모니터링 시스템을 대신 만드는 문서가 아니다.

이 문서는 특정 서비스 구현 세부가 아니라, 우리가 이 저장소에서 실제로 밟은 순서와 그 이유를 정리한다.

## One-Sentence Summary

하네스 엔지니어링은 아래 순서로 시작한다.

1. 헌법을 만든다
2. 문서를 진입점과 상세 문서로 분리한다
3. repository harness를 만든다
4. application harness를 만든다
5. save gate와 git hook을 연결한다
6. 앱 골격을 만든다
7. 실패를 구조화하고 self-repair loop를 붙인다
8. GC, architecture enforcement, CI, e2e로 고도화한다

## Why This Order

처음부터 코드부터 만들면 컨텍스트 부패가 생긴다.
처음부터 완전 자동 에이전트를 만들려 하면 실패한다.

따라서 순서는 항상 아래 원칙을 따른다.

- 규칙이 구현보다 먼저 와야 한다
- 문서가 코드보다 먼저 와야 한다
- gate가 기능 확장보다 먼저 와야 한다
- 실제 실패가 나오면 그 실패를 다시 rule, test, harness로 승격해야 한다

주의:

- 운영 대시보드, 실서비스 알림, APM은 하네스의 핵심 산출물이 아니다
- 그런 기능은 제품 운영 단계에서 별도 모니터링 도구로 다룬다
- 하네스는 개발자가 잘못 만든 코드를 저장소 안에서 조기에 막는 데 집중해야 한다

## Phase 0. Constitution First

가장 먼저 저장소의 최상위 규범을 만든다.

필수 문서:

- `CONSTITUTION.md`

최소 포함 항목:

- Purpose
- Core Values
- Non-Negotiables
- Authority Order
- Documentation Rule
- Data Safety Minimum
- Harness Scope

핵심 질문:

- 문서와 코드가 충돌하면 무엇이 우선인가
- 기능을 추가할 때 어떤 문서가 먼저 있어야 하는가
- 어떤 데이터는 절대 가볍게 다루면 안 되는가

## Phase 1. Entry Documents and Docs Layout

루트에는 진입점만 남기고, 상세 문서는 `docs/` 아래로 정리한다.

루트에 두는 문서:

- `AGENTS.md`
- `CONSTITUTION.md`
- `README.md`
- `REPOSITORY_HARNESS.md`
- 나중에 필요하면 `HARNESS_ENGINEERING.md`

그 외 제품/설계/엔지니어링 문서는 `docs/` 아래로 이동한다.

권장 구조:

```text
/
  AGENTS.md
  CONSTITUTION.md
  README.md
  REPOSITORY_HARNESS.md
  HARNESS_ENGINEERING.md
  harness/
  docs/
    index.md
    product/
    engineering/
    design/
```

핵심 원칙:

- `harness/`는 문서를 보관하는 곳이 아니라 문서를 검사하는 곳이다
- 루트는 사람과 에이전트의 진입점만 둔다

## Phase 2. Repository Harness

repository harness는 저장소 수준의 계약만 본다.
앱 코드가 없어도 먼저 만들 수 있다.

초기 검사 대상:

- 필수 문서 존재
- 에이전트 정의 존재
- 핵심 모델/아키텍처 문서 계약 존재
- 데이터 보호와 실패 대응 문서 존재

이 저장소에서 만든 형태:

- `harness/repository/run.py`
- `harness/repository/contracts.json`

핵심 원칙:

- repository harness는 "문서와 구조"를 본다
- 의미 해석이 큰 것은 사람이 보고, 기계가 확실히 볼 수 있는 것부터 자동화한다

## Phase 3. Application Harness

application harness는 실제 앱 동작 전에 "입출력 계약"부터 고정한다.

앱 코드가 없어도 먼저 만들 수 있는 것:

- agent response schema
- fixture 기반 validation
- 금지 필드 검사
- 배열 길이/required field 검사

이 저장소에서 만든 형태:

- `harness/application/run.py`
- `harness/application/contracts.json`
- `harness/application/fixtures/*.json`

핵심 원칙:

- 처음에는 fixture로도 충분하다
- 실제 앱이 생기면 같은 validator를 코드 출력에 붙인다

## Phase 4. Save Gate and Git Hooks

문서와 계약만 있으면 아직 약하다.
커밋과 푸시를 막는 gate가 필요하다.

초기 구성:

- `scripts/run-save-gate.sh`
- `scripts/run-save-gate.py`
- `.githooks/pre-commit`
- `.githooks/pre-push`
- `scripts/setup-githooks.sh`

pre-commit에서 막을 것:

- repository harness
- application harness
- content rules
- typecheck
- lint

pre-push에서 추가할 것:

- gc
- build

핵심 원칙:

- 성공은 조용히
- 실패만 짧고 구조화
- 사람이 부탁해서 고치게 하지 말고, 다음 단계로 못 넘어가게 막아라

## Phase 5. Harness Engineering Documents

이 시점에서 하네스 자체를 설명하는 문서를 만든다.

권장 문서:

- `HARNESS_ENGINEERING.md`
- `docs/engineering/save-gate.md`
- `docs/engineering/failure-to-rule.md`
- `docs/engineering/garbage-collection.md`

이 문서들의 역할:

- 왜 이 구조를 쓰는지 설명
- failure를 rule로 승격하는 정책 설명
- GC의 목적과 cadence 설명
- gate의 책임 설명

## Phase 6. Minimal App Skeleton

하네스가 최소선까지 올라오면 그 다음에야 실제 앱 골격을 만든다.

이 단계의 목표:

- 전체 기능 완성이 아니다
- 문서에 나온 라우트, 컴포넌트, API 형태를 코드로 찍어내는 것이다

권장 범위:

- landing page
- onboarding route skeleton
- API route skeleton
- mock data
- contract validation in route handlers

핵심 원칙:

- 외부 연동보다 flow skeleton이 먼저다
- 문서 계약에 없는 새 흐름은 만들지 않는다

## Phase 7. Failure Pipeline

여기서부터 하네스가 단순 차단기가 아니라 시스템이 된다.

구성 요소:

- `latest-report.json`
- `normalized-failures.json`
- `repair-context.json`
- `learned_failures.json`
- incident 문서

필수 스크립트:

- `scripts/parse_failures.py`
- `scripts/retry-agent.py`
- `scripts/log_incident.py`

이 단계의 흐름:

1. gate 실패 발생
2. 실패를 정규화
3. remediation hint 생성
4. retry context 생성
5. 반복 실패면 learned failure로 누적
6. 예산 소진 시 incident 기록

핵심 원칙:

- raw log를 그대로 다시 먹이지 않는다
- 실패는 packet으로 다시 만든다
- remediation hint는 짧고 수정 가능한 문장이어야 한다

## Phase 8. Self-Repair Orchestrator

failure packet만 있으면 아직 사람 손이 필요하다.
오케스트레이터를 붙여야 한다.

이 저장소에서는 Codex CLI를 사용했다.

구성:

- `scripts/codex_repair_runner.py`
- `scripts/run-self-repair-loop.sh`
- `SELF_REPAIR_LOOP.md`
- `docs/engineering/codex-orchestrator.md`

흐름:

1. gate 실패
2. parse failures
3. build repair context
4. non-interactive Codex CLI 재호출
5. 최소 수정 수행
6. 같은 gate 재실행
7. 실패 시 incident 기록

핵심 원칙:

- 무한 재시도 금지
- failure type별 retry budget 필요
- 규칙 약화, 테스트 삭제, 우회 금지

## Phase 9. Garbage Collection

GC는 메모리 해제가 아니라 코드베이스 오염 청소다.

초기 GC가 볼 것:

- unreferenced files
- forbidden debug markers
- doc drift
- duplicate logic candidates
- stale flag candidates

이 저장소에서 만든 형태:

- `harness/gc/run.py`
- `harness/reports/gc-candidates.json`

핵심 원칙:

- 처음엔 자동 삭제하지 않는다
- candidate report부터 만든다
- GC는 미관 작업이 아니라 패턴 오염 억제 장치다

## Phase 10. Architecture Enforcement

규칙은 문서에만 두면 약하다.
custom lint와 structural test로 승격한다.

이 저장소에서 넣은 예:

- `app/api` 는 `components` import 금지
- `lib` 는 `components` 나 `app` import 금지
- `components` 는 `app/api` import 금지

구성:

- `.eslintrc.json`의 `no-restricted-imports`
- `harness/architecture/run.py`
- `docs/architecture/invariants.md`

핵심 원칙:

- import boundary는 lint와 structural check 양쪽으로 막는 것이 좋다
- 불변조건은 반드시 문서와 검사 둘 다 있어야 한다

## Phase 11. CI and Required Checks

로컬 hook만으로는 부족하다.
원격에서도 같은 gate를 강제해야 한다.

이 저장소에서 만든 형태:

- `.github/workflows/ci.yml`
- `docs/engineering/required-checks.md`

권장 job 분리:

- `required-gates`
- `onboarding-e2e`

원칙:

- GitHub branch protection에서 required check 이름을 고정한다
- 실패 시 harness reports와 playwright artifacts를 업로드한다

## Phase 12. One Real End-to-End Test

하네스는 실제 사용자 플로우 하나는 끝까지 눌러봐야 한다.

권장 시작점:

- onboarding happy path 1개

구성:

- `playwright.config.ts`
- `tests/e2e/onboarding.spec.ts`

핵심 원칙:

- 모든 것을 한 번에 검증하려 하지 말고, 가장 중요한 흐름 하나부터 잡는다
- e2e가 발견한 실제 UI 문제는 테스트 우회가 아니라 UI 수정으로 해결한다

## Recommended Bootstrap Checklist

새 서비스에서 이 문서를 따라 시작할 때 최소 체크리스트:

1. `CONSTITUTION.md` 작성
2. `AGENTS.md` 작성
3. 문서 구조 정리
4. `repository harness` 추가
5. `application harness` 추가
6. `save gate` 추가
7. git hook 연결
8. `HARNESS_ENGINEERING.md` 작성
9. 앱 skeleton 추가
10. failure pipeline 추가
11. self-repair orchestrator 추가
12. GC 추가
13. architecture enforcement 추가
14. CI 추가
15. e2e 1개 추가

## What To Reuse In Another Service

다른 서비스에 이식할 때 그대로 가져가도 되는 것:

- `CONSTITUTION.md` 구조
- `AGENTS.md`의 원칙 섹션 구조
- `harness/repository/*`
- `harness/application/*`
- `scripts/run-save-gate.py`
- `scripts/run-self-repair-loop.sh`
- `scripts/parse_failures.py`
- `scripts/retry-agent.py`
- `scripts/log_incident.py`
- `scripts/codex_repair_runner.py`
- `.githooks/*`
- `HARNESS_ENGINEERING.md`
- `SELF_REPAIR_LOOP.md`

서비스별로 바꿔야 하는 것:

- product docs
- content rules
- architecture invariants
- GC candidate heuristics
- e2e flow
- import boundary rules

## Anti-Patterns

다른 서비스에 이식할 때 피해야 할 것:

1. 코드부터 만들고 나중에 문서 붙이기
2. raw failure log를 통째로 다시 모델에 주기
3. retry budget 없이 무한 self-repair loop 돌리기
4. 반복 실패를 문서에만 남기고 검사로 승격하지 않기
5. GC를 자동 삭제기처럼 쓰기
6. e2e 실패를 테스트 우회로 해결하기

## Final Rule

하네스 엔지니어링은 처음부터 완성되지 않는다.
하지만 시작 순서를 잘 잡으면, 이후의 모든 실패가 문서, rule, test, tool로 다시 돌아와 시스템을 강화한다.

새 서비스에서도 목표는 같다.

실수를 덜 하게 부탁하지 말고,
실수가 반복될 수 없게 구조를 먼저 심어라.
