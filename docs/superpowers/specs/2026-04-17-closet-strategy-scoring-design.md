# Closet Strategy Scoring Design

## Purpose

`closet_strategy`는 사용자가 실제로 자주 입고, 잘 맞고, 상태가 좋은 옷을 먼저 추천하도록 돕는 입력이다.
현재는 단순 키워드 포함 여부로 `core/use_with_care/optional`을 나누므로, 깨끗하지만 거의 안 입는 옷이 기본템으로 올라가는 문제가 생길 수 있다.

## Scope

- 옷장 아이템의 `wear_state`, `wear_frequency`, `condition`, `season`, `fit`, `notes`를 점수화한다.
- 기존 payload 구조인 `core_item_ids`, `caution_item_ids`, `optional_item_ids`, `items[].role`, `items[].reason`은 유지한다.
- `items[].score`를 선택 필드로 추가해 하네스와 디버깅에서 분류 근거를 확인할 수 있게 한다.
- 겉옷은 코디에 더하는 성격이 강하므로 상태가 나쁘지 않으면 기본적으로 `optional`로 둔다.

## Scoring Rules

- 잘 맞음, 자주 입음, 깨끗함, 사계절, 기본/단정/무난 신호는 가산한다.
- 작음, 큼, 타이트, 헐렁, 불편, 수선 필요, 오염, 낡음, 거의 안 입음 신호는 감산한다.
- `score >= 3`이면 `core`.
- `score <= -2`이면 `use_with_care`.
- 그 외는 `optional`.
- `outerwear`는 `score <= -2`일 때만 `use_with_care`, 나머지는 `optional`.

## Non-Goals

- 현재 계절을 자동 계산해 계절 부적합을 판단하지 않는다.
- 사진 자동 판독을 하지 않는다.
- 추천 결과를 서버에서 다시 작성하지 않는다.

## Verification

- 단위 테스트는 점수와 role 분류를 검증한다.
- E2E는 업로드 payload의 `closet_strategy`가 낮은 신뢰 아이템을 `core`로 보내지 않는지 검증한다.
- 문서와 AGENTS 규칙은 점수 기준을 하네스 원칙으로 고정한다.
