# Basis UI Harness Design

## Goal

추천 근거 UI가 다시 내부 상태명이나 점수 중심 표현으로 퇴행하지 않게 저장 게이트에서 잡는다.

## Problem

추천 근거 UI는 사용자에게 짧고 명확해야 한다. 그러나 코드 변경 과정에서 `직접 매칭`, `근거 후보`, `추천에 직접 사용`처럼 개발자 중심 표현이 다시 들어오면 화면은 동작해도 UX 품질이 낮아진다.

## Rule

MVP 하네스는 다음을 확인한다.

- 문서에 사용자-facing basis label이 정의되어 있다.
- 화면 코드가 `추천에 사용`, `비슷한 후보`, `추가 후보`를 사용한다.
- 화면 코드가 legacy label을 직접 노출하지 않는다.
- 화면 코드가 내부 `score`를 노출하지 않는다.

## Required Labels

- 추천에 사용
- 비슷한 후보
- 추가 후보
- 자주 입고 잘 맞음
- 핏/상태 확인
- 후보

## Legacy Labels

- 직접 매칭
- 근거 후보
- 추천에 직접 사용
- 가장 가까운 옷
- 있으면 추가

## Acceptance Criteria

- `npm run check:mvp` 출력에 `PASS basis-ui-labels`가 포함된다.
- 단위 테스트가 MVP 하네스의 `basis-ui-labels` 검사를 확인한다.
- 오탐을 피하기 위해 `score` 금지는 화면 render 파일에만 적용한다.
