# garbage-collection.md

## Purpose

이 문서는 AI 코딩 환경에서의 garbage collection을 정의한다.
여기서 garbage collection은 런타임 메모리 해제가 아니라, 코드베이스에 쌓이는 구조적 쓰레기를 주기적으로 청소하는 활동이다.

## Why It Exists

AI는 기존 코드를 학습 예시처럼 따라간다.
한 번 들어간 나쁜 패턴은 다음 코드 생성의 입력이 되고, 그 결과 더 많은 나쁜 패턴이 증식한다.

따라서 garbage collection은 선택이 아니라 필수다.

## Target Problems

garbage collection은 아래 문제를 탐지하고 정리한다.

1. 문서와 실제 코드가 달라진 경우
2. `CONSTITUTION.md`나 `AGENTS.md`를 위반하는 코드가 생긴 경우
3. 사용하지 않는 코드, 타입, 파일이 쌓인 경우
4. 임시 실험 코드가 정식 코드처럼 남아 있는 경우
5. 비슷한 로직이 복붙으로 증식한 경우
6. 과거 실패 패턴이 다른 위치에서 반복되는 경우

## Garbage Collector Agent

garbage collector agent는 기능 구현 에이전트와 다른 목적을 가진다.

- 새 기능을 만드는 것이 목적이 아니다.
- 이미 생긴 오염을 찾고 제거하는 것이 목적이다.
- 제거 과정에서 새 규칙 후보를 제안해야 한다.

## Review Checklist

주기적 청소 시 아래를 본다.

### Drift

- 문서에 있는 입력/출력 계약이 코드와 맞는가
- 문서에 있는 제한이 코드에 반영되어 있는가

### Dead Code

- 더 이상 호출되지 않는 함수가 있는가
- 더 이상 참조되지 않는 타입이나 파일이 있는가

### Rule Violations

- 금지된 패턴이 다시 등장했는가
- 임시 우회 코드가 남아 있는가

### Duplicate Patterns

- 같은 로직이 여러 위치에 흩어져 있는가
- 하나의 규칙 위반이 여러 파일에 전파되었는가

## Output

garbage collection 작업의 결과는 아래 셋 중 하나여야 한다.

1. 삭제
2. 리팩터링
3. 새 규칙 후보 제안

문제만 보고 끝내면 안 된다.
재발 가능성이 있는 문제는 규칙 후보까지 연결해야 한다.

## Cadence

garbage collection은 아래 시점에 수행할 수 있다.

- 큰 기능 추가 직후
- 릴리즈 전
- 규칙 위반이 두 번 이상 반복됐을 때
- 주기적 유지보수 슬롯에서

## Rule

청소는 미관 작업이 아니다.
이 활동의 목적은 미래의 오염 증식을 막는 것이다.
