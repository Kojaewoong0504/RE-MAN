# Style MVP Reliability Design

## Purpose

RE:MEN MVP의 핵심은 기능 수가 아니라 신뢰 가능한 기본 흐름이다.
이 설계는 스타일 체크 MVP를 "구현된 것처럼 보이는 상태"가 아니라, 반복 검증 가능한 제품 경로로 고정한다.

핵심 경로는 다음 하나다.

```text
로그인
  -> 스타일 체크 시작
  -> 사진 또는 텍스트 업로드
  -> 옷장 컨텍스트 포함
  -> 분석 실행
  -> 결과 확인
  -> 추천 반응 저장
  -> 기록 확인
  -> 비슷하게 다시 체크
```

## Scope

이 작업은 현재 스타일 MVP를 안정화한다.
새로운 제품 기능을 늘리는 작업이 아니다.

포함한다.

- MVP critical path 문서화
- 검증 매트릭스 문서화
- 완료 보고 규칙 강화
- 하네스가 확인해야 할 MVP 경계 추가
- 브라우저/비주얼 증거 산출물 기준 정리
- `check:mvp` 자동 점검 스크립트 추가

포함하지 않는다.

- 실착 UI 재노출
- 결제, 구독 구매, 환불 UI
- 외부 상품 카탈로그, 가격, 재고, 구매 링크
- 헤어, 피부, 체형, 향수 프로그램 구현
- 운영 장애 관제나 모니터링 하네스

## Current Product Baseline

현재 구현은 스타일 MVP의 기본 구조를 갖췄다.

- Google 로그인, 서버 JWT 세션, refresh token rotation이 있다.
- 보호 페이지와 `/api/feedback`은 로그인 세션을 요구한다.
- 스타일 체크는 사진 또는 텍스트 설명을 입력받는다.
- 현실 옷장 사진을 등록하고, 아이템명/색/핏/사이즈/착용감/빈도/계절/상태를 붙일 수 있다.
- 분석 payload에는 옷장 사진 원본이 아니라 `closet_items`, `closet_profile`, `closet_strategy`가 포함된다.
- 결과 화면은 추천 조합, 옷장 근거, 오늘 행동, 개선 포인트, 추천 반응 저장을 제공한다.
- 기록 화면은 저장된 결과와 반응을 카드로 보여주고, 비슷한 체크를 다시 시작할 수 있다.
- 크레딧 v0는 서버 메모리 원장과 idempotency 기반 차감을 제공한다.

하지만 아래는 아직 완료로 표현하면 안 된다.

- 실제 Gemini 사진 분석은 `smoke:feedback:gemini` 또는 `smoke:feedback:browser` 성공 전까지 완료로 보고하지 않는다.
- 실착 생성은 `TRY_ON_PROVIDER=mock` 상태에서 실제 생성으로 보고하지 않는다.
- 크레딧은 운영 결제 시스템이 아니다. 현재 원장은 `memory` 기반이다.
- 사이즈/상품 후보는 내부 기준 후보이며 실제 판매 상품 추천이 아니다.

## Reliability Model

검증은 층을 분리한다.

| Layer | Command | Meaning |
|---|---|---|
| Static | `npm run typecheck`, `npm run lint` | TypeScript와 린트가 깨지지 않음 |
| Unit | `npm run test:unit` | 순수 함수, 계약, 크레딧 계산, 추천 매칭 로직 검증 |
| Integration | `npm run test:integration` | API route, auth, credit, middleware 경계 검증 |
| Harness | `npm run check:repo`, `check:app`, `check:content`, `check:architecture`, `check:gc` | 문서/규칙/구조/GC 규칙 검증 |
| Mock E2E | `npm run test:e2e` | mock provider 기반 브라우저 사용자 흐름 검증 |
| Gemini API Smoke | `npm run smoke:feedback:gemini` | 실제 Gemini API 계약 검증 |
| Gemini Browser Smoke | `npm run smoke:feedback:browser` | 브라우저 업로드 흐름과 실제 Gemini 경계 검증 |
| Visual | `npm run visual:app` | 화면 배치와 전역 UI 표시 증거 생성 |
| Build | `npm run build` | 배포 가능한 Next.js 빌드 검증 |

`test:e2e`, `visual:*`, `build`는 `.next`와 3001 포트 자원을 공유하므로 병렬 실행하지 않는다.
이 명령은 `scripts/with-next-artifact-lock.py` 잠금을 통해 순차 실행해야 한다.

## Completion Reporting Rules

완료 보고는 검증 범위를 정확히 말해야 한다.

- mock E2E만 통과하면 "mock 사용자 흐름 통과"라고 말한다.
- `smoke:feedback:gemini`가 통과해야 "실제 Gemini API 계약 통과"라고 말한다.
- `smoke:feedback:browser`가 통과해야 "브라우저 업로드와 실제 Gemini 경계 통과"라고 말한다.
- `visual:app` 산출물을 확인해야 "UI 배치 확인"이라고 말한다.
- `build`가 통과해야 "배포 빌드 가능"이라고 말한다.

다음 표현은 금지한다.

- mock E2E만 돌리고 "사진 분석이 된다"고 말하기
- 텍스트 assertion만 보고 "화면이 잘 보인다"고 말하기
- 실패한 명령을 숨기고 다른 통과 결과만 보고하기
- provider, auth, storage, credit, payload, UI 경계를 분리하지 않고 "분석 실패"라고만 말하기

## Failure Classification

핵심 플로우 실패는 아래 경계 중 하나로 분류한다.

- `auth`: 로그인 세션, refresh, middleware, 보호 페이지 문제
- `credit`: 잔액, 차감, 환불, idempotency, 원장 불일치 문제
- `payload`: 사진/텍스트/옷장/선호 payload 누락 또는 변형 문제
- `provider`: Gemini 또는 try-on provider 호출/타임아웃/응답 포맷 문제
- `storage`: Supabase 임시 저장/삭제 문제
- `ui`: 버튼, 탭, 배지, 모달, 결과 화면, 기록 화면 표시 문제
- `visual`: 모바일/데스크톱 화면 배치 깨짐 문제
- `harness`: 규칙이 실패를 잡지 못했거나 잘못된 완료 보고를 허용한 문제

실패가 발생하면 다음 순서로 처리한다.

1. 실패 경계를 분류한다.
2. 원인을 수정한다.
3. 같은 실패를 다시 잡을 테스트, 하네스 규칙, 문서 중 하나 이상을 추가한다.
4. 실패한 검증 명령을 다시 실행해 통과를 확인한다.
5. 최종 보고에 실패와 수정 내용을 함께 남긴다.

## MVP Critical Path Checks

MVP critical path는 최소한 다음을 보장해야 한다.

- 비로그인 사용자는 `/closet`, `/history`, `/profile`, 스타일 분석 API에 접근할 수 없다.
- 로그인 사용자는 모든 핵심 앱 화면에서 크레딧 배지를 볼 수 있다.
- 스타일 체크 시작 CTA는 사용자를 기본 스타일 체크 경로로 보낸다.
- 사진 또는 유효한 텍스트 설명이 없으면 분석 시작이 비활성화된다.
- 옷장 아이템이 없으면 분석 시작이 비활성화된다.
- 분석 요청 payload에는 현재 전신 사진 1장만 이미지로 포함된다.
- 옷장 사진 원본은 `/api/feedback` payload에 포함되지 않는다.
- 옷장 메타데이터와 `closet_strategy`는 payload에 포함된다.
- 결과 화면은 추천 조합, 옷장 근거, 오늘 행동을 먼저 보여준다.
- deep-dive, try-on, 결제, 구매 CTA는 MVP 기본 결과 화면에 노출되지 않는다.
- 추천 반응 저장 후 다음 체크 payload에 `feedback_history`와 `preference_profile`이 포함된다.
- 기록 화면은 긴 문장 목록이 아니라 카드와 펼침 상세로 보여준다.
- 비슷하게 다시 체크는 옷장/반응/히스토리는 유지하고 현재 사진/결과/try-on 캐시만 비운다.

## Proposed Artifacts

### Product Docs

- `docs/product/mvp-critical-path.md`
  - MVP 경로, 성공 기준, 보류 기능을 한 문서에 고정한다.

- `docs/engineering/verification-matrix.md`
  - 각 검증 명령의 의미와 완료 보고 문구를 정의한다.

### Harness Updates

- `AGENTS.md`
  - 완료 보고 규칙과 실패 분류 규칙을 더 명확히 연결한다.

- 새 `harness/mvp/run.py`
  - critical path 문서 존재 여부와 핵심 문구를 검사한다.
  - `package.json`에 `check:mvp`를 추가한다.

### Tests

현재 E2E는 많은 핵심 흐름을 이미 검증한다.
이번 작업에서는 새 E2E를 늘리지 않고 하네스 검사를 보강한다.

- 완료 보고에 필요한 smoke 명령과 visual 명령이 문서화되어 있는지 확인하는 harness test
- critical path 문서가 보류 기능을 명확히 제한하는지 확인하는 content rule
- 기존 `test:e2e`의 "MVP 기본 결과 화면에 try-on/deep-dive/구매 CTA 없음" 검증 유지

## Implementation Sequence

1. `docs/product/mvp-critical-path.md` 작성
2. `docs/engineering/verification-matrix.md` 작성
3. `AGENTS.md` 검증 보고 규칙 정리
4. `harness/mvp/run.py`에 MVP 문서/규칙 검사 추가
5. `package.json`에 `check:mvp` 추가
6. 정적/단위/통합/하네스 검증 실행
7. 브라우저 E2E 실행
8. visual smoke 실행 후 산출물 확인
9. build 실행

## Acceptance Criteria

- MVP critical path가 문서로 고정되어 있다.
- 검증 명령의 의미가 문서로 고정되어 있다.
- mock, Gemini API, Gemini browser, visual, build 완료 보고가 서로 구분된다.
- 하네스가 critical path 문서 또는 검증 매트릭스 누락을 잡는다.
- 기존 핵심 테스트와 하네스가 통과한다.
- UI 완료 보고에는 visual smoke 산출물 경로가 포함된다.

## Risks

- 실제 Gemini smoke는 환경 변수와 네트워크에 의존한다.
  실패 시 앱 로직 실패인지 환경 실패인지 분리해야 한다.
- visual smoke는 캡처 생성만으로 디자인 품질을 보장하지 않는다.
  주요 화면은 사람이 실제 이미지를 확인해야 한다.
- 현재 워크트리에 미커밋 변경이 많다.
  구현 전에는 변경 범위를 좁혀 커밋하거나, 최소한 작업 단위를 명확히 나눠야 한다.
