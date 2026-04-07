# invariants.md

## Purpose

이 문서는 이 저장소에서 절대 쉽게 깨뜨리면 안 되는 구조 불변조건을 정의한다.
이 항목들은 시간이 지나면 문서가 아니라 lint, harness, architectural test로 승격되어야 한다.

## Product Invariants

1. 앱의 핵심 목적은 사진 또는 텍스트 설명을 기반으로 스타일 피드백을 주는 것이다.
2. 설문은 3개를 넘기지 않는다.
3. onboarding-agent는 `day1_mission`을 반환하고 `tomorrow_preview`를 반환하지 않는다.
4. daily-agent는 `tomorrow_preview`를 반환하고 `day1_mission`을 반환하지 않는다.
5. Day 6 이전에는 구매 유도 액션을 넣지 않는다.

## Safety Invariants

1. 사용자 사진은 분석 후 저장하지 않는다.
2. 민감 데이터는 목적과 보관 범위 없이 추가하지 않는다.
3. fallback 메시지는 문서와 코드가 동일 의미를 유지해야 한다.

## Architecture Invariants

1. `lib/agents/contracts.ts`가 에이전트 입출력의 기준이다.
2. API route는 계약을 검증한 뒤에만 응답을 반환한다.
3. UI는 문서에 없는 새 플로우를 먼저 만들지 않는다.
4. 반복 실패는 incident, rule, harness 중 하나로 반드시 승격한다.

## Harness Invariants

1. pre-commit은 최소 문서 계약, content rules, typecheck, lint를 막아야 한다.
2. pre-push는 여기에 gc와 build를 추가로 막아야 한다.
3. failure report는 JSON으로 남아야 한다.
4. self-repair loop는 무한 재시도를 허용하지 않는다.

## Promotion Rule

이 문서에 있는 항목이 두 번 이상 수동으로 언급되면 다음 우선순위로 승격한다.

1. custom lint
2. structural test
3. repository/application harness
4. CI required check
