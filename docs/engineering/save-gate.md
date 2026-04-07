# save-gate.md

## Purpose

이 문서는 저장소의 save gate를 정의한다.
목표는 사람이 부탁해서 품질을 맞추는 것이 아니라, 기준을 통과하지 못하면 다음 단계로 진행되지 못하게 하는 것이다.

## Principle

성공은 조용히 지나가고, 실패만 시끄럽게 보여야 한다.

- 통과 로그를 길게 출력하지 않는다.
- 실패 시에만 짧고 구조화된 메시지를 출력한다.
- 실패한 변경은 커밋이나 푸시로 넘어갈 수 없다.

## Gate Levels

### Level 1. Save-Time

가장 이상적인 형태는 저장 시 즉시 검사다.
다만 이 단계는 에디터와 로컬 환경에 종속적이므로 저장소 차원에서 완전 강제하기 어렵다.

따라서 현재 저장소의 공식 강제점은 아래 두 단계다.

### Level 2. Pre-Commit

커밋 전에 반드시 아래를 통과해야 한다.

1. repository harness
2. application harness
3. content rules
4. 타입 체크
5. 린트

이 단계는 저장소 구조와 에이전트 계약이 깨졌는지 빠르게 확인하는 최소 게이트다.

### Level 3. Pre-Push

푸시 전에는 pre-commit보다 더 무거운 검사를 둘 수 있다.

- 타입 체크
- 린트
- build
- garbage collection 검사

현재 앱 코드가 없으므로 이 단계는 예약만 해 둔다.

## Failure Output

실패 출력은 아래 원칙을 따른다.

1. 어떤 게이트가 실패했는지 보인다
2. 왜 실패했는지 한 줄씩 보인다
3. 성공 항목은 요약만 한다
4. 불필요한 장문 로그는 출력하지 않는다

## Current v0 Behavior

현재 save gate v0는 아래만 강제한다.

1. `python3 harness/repository/run.py`
2. `python3 harness/application/run.py`
3. `python3 harness/application/content_rules.py`
4. `npm run typecheck`
5. `npm run lint`

pre-push에서는 여기에 아래가 추가된다.

6. `python3 harness/gc/run.py`
7. `npm run build`

하나라도 실패하면 gate는 실패다.

## Future v1

앱 코드가 생기면 아래를 pre-push 또는 CI gate로 확장한다.

1. 테스트
2. dead code 탐지 고도화
3. garbage collection 검사 고도화
4. self-repair orchestration 연결
