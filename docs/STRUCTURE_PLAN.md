# STRUCTURE_PLAN.md

## Goal

루트에는 저장소의 진입점만 남기고, 상세 문서는 `docs/` 아래로 정리한다.
이 구조는 사람이 읽기 쉬워야 하고, 이후 repository harness와 application harness가 참조하기 쉬워야 한다.

## Root Files To Keep

- `AGENTS.md`
- `CONSTITUTION.md`
- `README.md`
- `REPOSITORY_HARNESS.md`
- `harness/`

`REPOSITORY_HARNESS.md`는 현재 기준으로 루트에 둔다.
향후 repository harness 실행 문서가 `harness/repository/README.md`로 충분히 대체되면 이동을 다시 검토할 수 있다.

## Planned Docs Layout

```text
docs/
  index.md
  product/
    core-beliefs.md
    product-sense.md
    onboarding.md
    coaching-flow.md
    plans.md
  engineering/
    architecture.md
    frontend.md
    security.md
    reliability.md
  design/
    design.md
```

## Move Map

| Current | Planned |
|---|---|
| `core-beliefs.md` | `docs/product/core-beliefs.md` |
| `PRODUCT_SENSE.md` | `docs/product/product-sense.md` |
| `new-user-onboarding.md` | `docs/product/onboarding.md` |
| `1week-coaching-flow.md` | `docs/product/coaching-flow.md` |
| `PLANS.md` | `docs/product/plans.md` |
| `ARCHITECTURE.md` | `docs/engineering/architecture.md` |
| `FRONTEND.md` | `docs/engineering/frontend.md` |
| `SECURITY.md` | `docs/engineering/security.md` |
| `RELIABILITY.md` | `docs/engineering/reliability.md` |
| `DESIGN.md` | `docs/design/design.md` |

## Harness Implications

repository harness는 최종적으로 아래를 전제로 해야 한다.

1. 루트 진입점 문서 존재
2. `docs/index.md` 존재
3. 필수 문서가 계획된 위치에 존재
4. 루트 진입점에서 상세 문서로 이동 경로를 찾을 수 있음

application harness는 문서 위치 변경과 무관하게 계약 문서를 경로로 참조할 수 있어야 한다.

## Not Doing Yet

이번 단계에서는 아래 작업을 하지 않는다.

- repository harness 스크립트 작성

문서 이동과 기본 경로 정리는 완료했다.
남은 항목은 repository harness 구현이다.
