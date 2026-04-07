# REPOSITORY_HARNESS.md

## 1. Purpose

repository harness는 저장소 수준의 계약 위반을 조기에 잡기 위한 장치다.
앱이 아직 완성되지 않았더라도 문서와 구조가 헌법을 벗어나지 않는지 검사해야 한다.

이 문서는 repository harness가 무엇을 검사해야 하는지 정의한다.

## 2. Minimum Contracts

### Contract 1. Constitution must exist

- 저장소 루트에 `CONSTITUTION.md`가 존재해야 한다.
- repository harness는 이 파일이 없으면 실패해야 한다.

### Contract 2. Feature changes require documentation first

- 새 기능이나 동작 변경은 먼저 문서에 정의되어 있어야 한다.
- 기능 문서에는 최소한 목적, 입력, 출력, 제약이 있어야 한다.
- 문서 없이 기능 파일만 추가된 상태는 실패로 본다.

### Contract 3. Agent definitions must not conflict

- 문서에 정의된 에이전트 이름과 역할은 서로 충돌하면 안 된다.
- 호출 시점, 입력 형식, 출력 형식의 핵심 설명이 문서마다 달라지면 실패로 본다.

### Contract 4. User data handling must be documented

- 사용자 데이터를 다루는 기능에는 보관 여부, 삭제 시점, 보호 규칙이 문서에 있어야 한다.
- 특히 사진, 개인 식별 가능 정보, 인증 정보는 문서 없는 저장이나 장기 보관을 허용하지 않는다.

### Contract 5. Tests must not contradict the docs

- 테스트가 통과하더라도 문서와 반대되는 계약을 주장하면 올바른 상태가 아니다.
- repository harness는 테스트 이름, 테스트 설명, 테스트 픽스처가 상위 문서와 정면 충돌하는지 검사 대상에 포함할 수 있다.

## 3. Check Classification

### Automatically Checkable

아래는 기계적으로 검사 가능한 항목이다.

1. `CONSTITUTION.md` 존재 여부
2. 필수 기능 문서 존재 여부
3. 문서 안에 목적, 입력, 출력, 제약 섹션이 있는지 여부
4. 에이전트 이름의 존재와 개수
5. 응답 형식 필드명이 문서 간 일치하는지 여부
6. 사용자 데이터 보관/삭제 관련 규칙이 문서에 명시되어 있는지 여부

### Human Review Required

아래는 기계 검사만으로 충분하지 않다.

1. 문서 설명은 같아 보이지만 실제 의미가 충돌하는 경우
2. 테스트가 문서를 교묘하게 우회하는 경우
3. 데이터 보호 규칙이 존재하더라도 실제로 충분한지 여부
4. 초보자가 읽고 따라갈 수 있는 수준인지 여부

## 4. First Repository Harness Boundary

초기 repository harness는 아래 범위까지만 자동화한다.

1. 헌법 문서 존재 검사
2. 필수 문서 존재 검사
3. 에이전트 정의 일치 검사
4. 입력/출력 계약 키 일치 검사
5. 사용자 데이터 처리 규칙 명시 여부 검사

의미 해석이 많이 필요한 항목은 초기에는 사람 리뷰 대상으로 둔다.

## 5. Required Documents

초기 repository harness가 필수로 요구하는 문서는 아래 5개다.

1. `CONSTITUTION.md`
2. `AGENTS.md`
3. `docs/engineering/architecture.md`
4. `docs/engineering/security.md`
5. `docs/engineering/reliability.md`

이 문서들 중 하나라도 없으면 repository harness는 실패해야 한다.

## 6. Open Questions

- "새 기능 파일"의 범위를 어디까지로 볼 것인가
- 테스트와 문서의 충돌을 repository 단계에서 어느 정도까지 검사할 것인가
