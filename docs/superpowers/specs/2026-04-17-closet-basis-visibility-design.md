# Closet Basis Visibility Design

## Purpose

Style Check 결과 화면에서 사용자가 “추천이 내 옷장을 실제로 봤다”는 느낌을 즉시 받을 수 있게 한다.
추천 조합 자체는 이미 표시되지만, 옷장 반영 근거가 칩과 접힌 상세에 나뉘어 있어 첫 화면 체감이 약하다.

## Scope

- Gemini/mock 응답 계약은 변경하지 않는다.
- `/api/feedback` payload 구조도 변경하지 않는다.
- 기존 `closet_items`, `closet_strategy`, `recommended_outfit.source_item_ids`를 클라이언트에서 요약한다.
- 결과 화면 `Closet Basis` 섹션 상단에 짧은 사용률 요약과 선택 이유를 추가한다.

## UX Rules

- 섹션 제목은 사용자가 이해하기 쉬운 `내 옷장에서 쓴 것`으로 바꾼다.
- 첫 화면에 `상의 · 하의 · 신발 중 N개 반영` 형태의 요약을 보여준다.
- 첫 화면에 가장 중요한 근거 1줄을 보여준다.
- 긴 설명, 상태, 착용감 상세는 기존 `근거 자세히 보기` 안에 유지한다.
- 문장은 짧게 유지한다. 한 카드에 긴 설명을 넣지 않는다.

## Data Flow

1. `ResultPage`가 local onboarding state에서 `closet_items`와 `feedback`을 읽는다.
2. `buildClosetBasisMatches`가 기존처럼 카테고리별 근거 아이템을 만든다.
3. 새 helper가 basis 배열을 받아 첫 화면용 summary를 만든다.
4. UI는 summary와 basis chip을 함께 보여준다.

## Testing

- 단위 테스트로 summary count와 short reason을 검증한다.
- E2E로 결과 화면에서 `내 옷장에서 쓴 것`, `상의 · 하의 · 신발 중`, `흰색 무지 티셔츠`가 보이는지 검증한다.
- visual smoke로 모바일/데스크톱 결과 화면 배치를 확인한다.

## Non-Goals

- 옷장 사진 자동 판독을 구현하지 않는다.
- Gemini prompt 계약을 바꾸지 않는다.
- 실착 생성이나 상품 추천을 다시 노출하지 않는다.
