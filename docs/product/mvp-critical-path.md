# MVP Critical Path

## Purpose

RE:MEN Style MVP는 기능을 많이 보여주는 앱이 아니라, 사용자의 현재 전신 사진과 현실 옷장 컨텍스트를 받아 바로 쓸 수 있는 스타일 추천을 제공하는 앱이다.

이 문서는 MVP에서 반드시 지켜야 할 핵심 경로와, 아직 구현된 기능처럼 표현하면 안 되는 보류 영역을 고정한다.

## Critical Path

```text
로그인
  -> 스타일 체크 시작
  -> 사진 또는 텍스트 업로드
  -> 현실 옷장 컨텍스트 포함
  -> 분석 실행
  -> 추천 조합 결과 확인
  -> 추천 반응 저장
  -> 기록 확인
  -> 비슷하게 다시 체크
```

## Must Work

- 비로그인 사용자는 `/closet`, `/history`, `/profile`, 스타일 분석 API에 접근할 수 없다.
- 로그인 사용자는 홈, 스타일, 옷장, 기록, 내 정보, 설정, 결과 화면에서 크레딧 배지를 볼 수 있어야 한다.
- 스타일 체크 시작 CTA는 기본 스타일 체크 경로로 이동해야 한다.
- 사진 또는 유효한 텍스트 설명이 없으면 분석 시작이 비활성화되어야 한다.
- 상의, 하의, 신발 중 하나라도 없으면 분석 시작이 비활성화되어야 한다.
- 분석 요청은 현재 전신 사진 1장만 이미지로 포함해야 한다.
- 옷장 사진 원본은 `/api/feedback` payload에 포함하지 않는다.
- 옷장 메타데이터와 `closet_strategy`는 `/api/feedback` payload에 포함한다.
- 옷장 등록은 한 벌 직접 등록과 빠른 대량 촬영 등록을 모두 제공해야 한다.
- 대량 촬영 draft는 사용자 확인 전까지 `closet_items`로 승격하지 않는다.
- 사이즈는 사진 1장만으로 확정하지 않고 `size_source`로 출처를 구분한다.
- `closet_strategy`는 착용감, 착용 빈도, 계절, 상태, 메모를 점수화해 core/use_with_care/optional을 나눈다.
- provider가 반환한 `source_item_ids`는 현재 `closet_items`의 같은 카테고리 id로 검증한 뒤에만 직접 매칭으로 사용한다.
- 결과 화면은 추천 조합, 옷장 근거, 오늘 행동을 먼저 보여준다.
- 결과 화면의 `조합 느낌 보기`는 생성 없는 레퍼런스/준비 안내로만 동작한다.
- 추천 반응 저장 후 다음 체크 payload에 `feedback_history`와 `preference_profile`을 포함한다.
- 기록 화면은 카드와 펼침 상세로 결과를 보여준다.
- 비슷하게 다시 체크는 옷장, 반응, 히스토리는 유지하고 현재 사진, 결과, try-on 캐시만 비운다.

## Deferred Scope

- 실착 UI는 MVP 기본 결과 화면에 노출하지 않는다.
- 실착 생성 CTA는 MVP 기본 결과 화면에 노출하지 않는다.
- `조합 느낌 보기`는 `/api/try-on`을 호출하지 않는다.
- deep-dive 생성 CTA는 MVP 기본 결과 화면에 노출하지 않는다.
- 결제, 구독 구매, 환불 UI는 구현하지 않는다.
- 외부 상품 카탈로그, 가격, 재고, 구매 링크는 제공하지 않는다.
- 헤어, 피부, 체형, 향수 프로그램은 준비 중 구조만 유지한다.
- 운영 장애 관제나 모니터링은 이 하네스의 목적이 아니다.

## Completion Rules

- mock E2E 통과만으로 실제 Gemini 사진 분석 완료라고 말하지 않는다.
- Gemini API smoke 통과 전에는 실제 Gemini API 계약 통과라고 말하지 않는다.
- Gemini browser smoke 통과 전에는 브라우저 업로드와 실제 Gemini 경계가 통과했다고 말하지 않는다.
- visual smoke 산출물 확인 전에는 UI 배치가 확인됐다고 말하지 않는다.
- build 통과 전에는 배포 빌드 가능이라고 말하지 않는다.

## Failure Boundaries

- `auth`: 로그인 세션, refresh, middleware, 보호 페이지
- `credit`: 잔액, 차감, 환불, idempotency, 원장 불일치
- `payload`: 사진, 텍스트, 옷장, 선호 payload 누락 또는 변형
- `provider`: Gemini 또는 try-on provider 호출, 타임아웃, 응답 포맷
- `storage`: Supabase 임시 저장 또는 삭제
- `ui`: 버튼, 탭, 배지, 모달, 결과 화면, 기록 화면
- `visual`: 모바일 또는 데스크톱 화면 배치
- `harness`: 규칙이 실패를 잡지 못했거나 잘못된 완료 보고를 허용함
