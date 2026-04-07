# SELF_REPAIR_LOOP.md

## Purpose

이 문서는 이 저장소의 self-repair loop를 정의한다.
목표는 실패를 사람이 수동으로 읽고 부탁해서 고치는 것이 아니라, 실패를 구조화해 다시 수정 입력으로 되돌리는 것이다.

## Completion Criteria

self-repair loop가 완성됐다고 보려면 아래가 모두 필요하다.

1. gate 실패를 기계가 읽을 수 있는 형식으로 저장한다
2. 실패가 어느 규칙, 어느 파일, 어느 단계에서 났는지 식별 가능하다
3. 그 실패 리포트를 다시 모델 입력으로 사용할 수 있다
4. 수정 후 같은 gate를 자동으로 재실행한다
5. 반복 실패는 규칙 승격 후보로 남긴다

현재 저장소는 이 중 1, 2, 3의 최소 형태를 구현한다.

## Current Loop

현재 self-repair loop는 아래 순서로 동작한다.

1. `scripts/run-save-gate.sh` 실행
2. 각 검사 결과를 `harness/reports/latest-report.json`에 기록
3. 실패 시 `scripts/run-self-repair-loop.sh`가 해당 리포트를 보존
4. 후속 에이전트 또는 사람은 그 JSON을 보고 수정 작업을 시작

## Failure Report Schema

실패 리포트는 최소 아래 필드를 가진다.

- `mode`: `pre-commit` 또는 `pre-push`
- `ok`: 전체 통과 여부
- `checks`: 개별 검사 결과 배열
- `summary`: 전체 성공/실패 개수

개별 check 항목은 아래 필드를 가진다.

- `name`: 검사 이름
- `ok`: 성공 여부
- `command`: 실행한 명령
- `output`: 실패 또는 성공 출력

## Escalation Rule

같은 실패가 반복되면 단순 수정으로 끝내지 않는다.
반복 실패는 아래 문서 중 하나로 승격 후보가 된다.

1. `AGENTS.md`
2. `docs/engineering/failure-to-rule.md`
3. `docs/engineering/garbage-collection.md`
4. repository/application harness

## What Is Still Missing

현재 저장소에는 아직 아래가 없다.

1. 실패 JSON을 읽고 모델을 자동 재호출하는 실행기
2. 재시도 횟수 제한과 자동 중단 규칙
3. 반복 실패를 자동으로 분류하는 승격기

즉 현재는 self-repair loop의 완성형이 아니라, 오케스트레이션 직전 단계다.
